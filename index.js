'use strict';

/* child_process.exec vs exec.exec
 * MSYS2 commands work with exec.exec, but not child_process.exec
 * may be due to STDERR handling
 * generally, child_process.exec for Windows commands
 *
 */

const fs    = require('fs')
const path  = require('path')
const child_process = require('child_process')

const tc    = require('@actions/tool-cache')
const core  = require('@actions/core')
const exec  = require('@actions/exec')

const IS_WINDOWS = process.platform === 'win32'

const base     = core.getInput('base').trim().toLowerCase()
const msys2Loc = core.getInput('msys2-loc').trim()

let   rubyExt  = core.getInput('ruby-version').toString().trim().replace(/\.x$/, '')
let   mingw    = core.getInput('mingw').trim().toLowerCase()
let   msys2    = core.getInput('msys2').trim().toLowerCase()

if ((rubyExt === 'ruby-head') || (rubyExt === '9.9')) { rubyExt = 'mingw' }

const rubyIdx = IS_WINDOWS ?
  [ '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', 'mingw', 'mswin'].indexOf(rubyExt) :
  [ '2.2', '2.3', '2.4', '2.5', '2.6', '2.7' ].indexOf(rubyExt)

if (rubyExt !== '' && rubyIdx < 0) {
  core.setFailed(`Incorrect Ruby version: ${rubyExt}`)
}

core.exportVariable('TMPDIR', process.env.RUNNER_TEMP)

const args  = '--noconfirm --noprogressbar --needed'

let newPath = process.env.PATH.replace(/[^;]+?(Chocolatey|CMake|mingw64|OpenSSL|Strawberry|Subversion|tools\\php)[^;]*;/g, '')

let bits = '64'
const prefix = (bits === '64') ? ' mingw-w64-x86_64-' : ' mingw-w64-i686-'

// Install Ruby versions from RubyInstaller (2.2.6 & 2.3.3) and RubyInstaller2 (2.4 and later)
const installRubyWin = async () => {

  const riURI  = 'https://dl.bintray.com/oneclick/rubyinstaller'

  const ri2URI = 'https://github.com/oneclick/rubyinstaller2/releases/download'

  const rlURI  = 'https://github.com/MSP-Greg/ruby-loco/releases/download/ruby-master'

  const rubyInfo = {
    '2.2':    { uri: riURI , fn: 'ruby-2.2.6-x64-mingw32', ext: '7z', dn: 'Ruby22-x64' },
    '2.3':    { uri: riURI , fn: 'ruby-2.3.3-x64-mingw32', ext: '7z', dn: 'Ruby23-x64' },
    '2.4':    { uri: ri2URI, fn: 'RubyInstaller-2.4.9-1' , ext: '7z', dn: 'Ruby24-x64' },
    '2.5':    { uri: ri2URI, fn: 'RubyInstaller-2.5.7-1' , ext: '7z', dn: 'Ruby25-x64' },
    '2.6':    { uri: ri2URI, fn: 'RubyInstaller-2.6.5-1' , ext: '7z', dn: 'Ruby26-x64' },
    '2.7':    { uri: ri2URI, fn: 'RubyInstaller-2.7.0-1' , ext: '7z', dn: 'Ruby27-x64' },
    'mingw':  { uri: rlURI , fn: 'ruby-mingw'            , ext: '7z', dn: 'Ruby-mingw' },
    'mswin':  { uri: rlURI , fn: 'ruby-mswin'            , ext: '7z', dn: 'Ruby-mswin' }
  }

  const drive = (process.env.GITHUB_WORKSPACE || 'C')[0]

  let ruby = rubyInfo[rubyExt]

  if (ruby.uri === ri2URI) {
    let fn = `${ruby.fn}-x64`
    let fldr = fn.toLowerCase()
    const rubyPath = await tc.downloadTool(`${ruby.uri}/${ruby.fn}/${fldr}.${ruby.ext}`)
    child_process.execSync(`7z x ${rubyPath} -xr!${fldr}\\share\\doc -o${drive}:\\`)
    fs.renameSync(`${drive}:\\${fldr}`, `${drive}:\\${ruby.dn}`)
  } else {
    const rubyPath = await tc.downloadTool(`${ruby.uri}/${ruby.fn}.${ruby.ext}`)
    child_process.execSync(`7z x ${rubyPath} -o${drive}:\\`)
    fs.renameSync(`${drive}:\\${ruby.fn}`, `${drive}:\\${ruby.dn}`)
  }
  newPath = `${drive}:\\${ruby.dn}\\bin;${newPath}`

  // Old Rubies don't set OpenSSL::X509::DEFAULT_CERT_FILE correctly
  if (rubyExt <= '2.3') {
    const ri2Cert = `${msys2Loc}\\..\\SSL\\cert.pem`
    if (fs.existsSync(ri2Cert)) {
      process.env.SSL_CERT_FILE = ri2Cert.replace(/\\/, '/')
    }
  }

  // Install Bundler for Ruby 2.5 and earlier
  if (rubyExt <= '2.5') {
    await exec.exec(`${drive}:\\${ruby.dn}\\bin\\gem install bundler -v "~> 1" --no-document`)
  }
}

const addMSWinCerts = () => {
  // create cert dir
  const msCertDir = 'C:\\Program Files\\Common Files\\SSL\\certs'
  if (!fs.existsSync(msCertDir)) {
    fs.mkdirSync(msCertDir, { recursive: true })
  }

  // Copy cert file
  const msCert = 'C:\\Program Files\\Common Files\\SSL\\cert.pem'

  if (!fs.existsSync(msCert)) {
    const ri2Cert = `${msys2Loc}\\..\\SSL\\cert.pem`
    if (fs.existsSync(ri2Cert)) {
      fs.copyFileSync(ri2Cert, msCert)
    }
  }
}

/* Removes extra Ruby and other items from path, add mSYS2 items
 * Add ENV data for mswin
 * Note: called before Ruby is installed
 */
const addPathEnv = async () => {
  if (rubyExt !== '') {
    // remove existing path, regex to match Ruby\2.5.5\x64\bin
    newPath = newPath.replace(/[^;]+Ruby\\\d\.\d+\.\d+\\x64\\bin;/, '')
  }
  if (rubyExt !== 'mswin') {
    // Add msys2 to path
    const dirMSYS2 = 'C:\\msys64'

    if (!fs.existsSync(msys2Loc)) {
      throw new Error(`Folder ${msys2Loc} does not exist`)
    }

    if (!fs.existsSync(dirMSYS2)) {
      fs.renameSync(msys2Loc, dirMSYS2)
    }
    newPath = `C:\\Program Files\\7-Zip;${newPath}`
    newPath = `${dirMSYS2}\\mingw64\\bin;${dirMSYS2}\\usr\\bin;${newPath}`
  } else {
    // add vcvars64.bat to ENV for msvc builds
    core.exportVariable('VCVARS', 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat')
    addMSWinCerts()
  }
}

// Install OpenSSL 1.0.2 for Ruby 2.3 & 2.4, 1.1.1 for Ruby 2.5 and later
const openssl = async () => {
  let ssl = 'C:\\Windows\\System32\\'
  let ary = [`${ssl}libcrypto-1_1-x64.dll`, `${ssl}libssl-1_1-x64.dll`]
  ary.forEach( (bad) => {
      if (fs.existsSync(bad)) { fs.renameSync(bad, `${bad}_`) }
  })

  let rubyABIVers = child_process.execSync(`ruby.exe -e "STDOUT.write RbConfig::CONFIG['ruby_version']"`).toString().trim()

  if (rubyABIVers >= '2.5') {
    if (rubyExt !== 'mswin') {
      const openssl = `${prefix}openssl`
      await exec.exec(`pacman.exe -S ${args} ${openssl}`)
    } else {
      await exec.exec('C:\\ProgramData\\Chocolatey\\bin\\choco install --no-progress openssl')
      fs.renameSync('C:\\Program Files\\OpenSSL-Win64', 'C:\\openssl-win')
    }
  } else if (rubyABIVers === '2.4.0') {
    const openssl_24 = `https://dl.bintray.com/larskanis/rubyinstaller2-packages/${prefix.trim()}openssl-1.0.2.t-1-any.pkg.tar.xz`
    const openssl_24_path = await tc.downloadTool(openssl_24)
    await exec.exec(`pacman.exe -Udd --noconfirm --noprogressbar ${openssl_24_path}`)
  } else if (rubyABIVers <= '2.4') {
    const openssl_23 = 'http://dl.bintray.com/oneclick/OpenKnapsack/x64/openssl-1.0.2j-x64-windows.tar.lzma'
    const openssl_23_path = await tc.downloadTool(openssl_23)
    fs.mkdirSync('C:\\openssl-win')
    let fn = openssl_23_path.replace(/:/, '').replace(/\\/, '/')
    await exec.exec(`tar.exe --lzma -C /c/openssl-win --exclude=ssl/man -xf /${fn}`)
    core.info('Installed OpenKnapsack openssl-1.0.2j-x64 package')
  }
}

// Updates MSYS2 MinGW gcc items
const updateGCC = async () => {
  // full update, takes too long
  // await exec.exec(`pacman.exe -Syu ${args}`);
  // await exec.exec(`pacman.exe -Su  ${args}`);
  let gccPkgs = ['', 'binutils', 'crt', 'dlfcn', 'headers', 'libiconv', 'isl', 'make', 'mpc', 'mpfr', 'windows-default-manifest', 'libwinpthread', 'libyaml', 'winpthreads', 'zlib', 'gcc-libs', 'gcc']
  await exec.exec(`pacman.exe -S ${args} ${gccPkgs.join(prefix)}`)
}

// Updates MSYS2 package databases, call updateGCC when base value is 'update'
const runBase = async () => {
  // setup and update MSYS2
  await exec.exec(`bash.exe -c "pacman-key --init"`)
  await exec.exec(`bash.exe -c "pacman-key --populate msys2"`)
  await exec.exec(`pacman.exe -Sy`)

  if (base.includes('update')) { await updateGCC(); }
}

// Install MinGW packages from mingw input
const runMingw = async () => {
  if (mingw.includes('openssl')) {
    await openssl();
    mingw = mingw.replace(/openssl/gi, '').trim()
  }
  if (rubyExt !== 'mswin') {
    // remove bad characters (external input on command line)
    mingw = mingw.replace(/[^a-z_ \d.-]+/gi, '').trim()
    if (mingw !== '') {
      let pkgs = mingw.split(/ +/)
      if (pkgs.length > 0) {
        pkgs.unshift('')
        await exec.exec(`pacman.exe -S ${args} ${pkgs.join(prefix)}`)
      }
    }
  }
}

// Install MYS2 packages from mys2 input
const runMSYS2 = async () => {
  msys2 = msys2.replace(/[^a-z_ \d.-]+/gi, '').trim()
  if (msys2 !== '') {
    if (rubyExt !== 'mswin') {
      await exec.exec(`pacman.exe -S ${args} ${msys2}`)
    }
  }
}

const run = async () => {
  try {
    if (IS_WINDOWS) {
      await addPathEnv();
      if (rubyExt !== '') { await installRubyWin() }

      core.exportVariable('PATH', newPath)
      core.exportVariable('CI', 'true')
      process.env.PATH = newPath

      if ((base  !== '') && (rubyExt !== 'mswin')) { await runBase()  }
      if (mingw !== '') { await runMingw() }
      if (msys2 !== '') { await runMSYS2() }
    } else {
      const installDir = tc.find('Ruby', rubyExt)
      if (!installDir) {
          throw new Error(`Version ${rubyExt} not found`)
      }
      const toolPath = path.join(installDir, 'bin')
      core.addPath(toolPath);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}
run()

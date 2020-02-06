'use strict';

const core  = require('@actions/core');
const exec  = require('@actions/exec');
const tc    = require('@actions/tool-cache');

const child = require('child_process');
const fs    = require("fs");
const path  = require("path");

const args  = '--noconfirm --noprogressbar --needed';

const base     = core.getInput('base').trim().toLowerCase();
const msys2Loc = core.getInput('msys2-loc').trim();
let   mingw    = core.getInput('mingw').trim().toLowerCase();
let   msys2    = core.getInput('msys2').trim().toLowerCase();
const rubyExt  = core.getInput('ruby-version').trim();

const IS_WINDOWS = process.platform === 'win32';

const rubyIdx = [ '2.3.x', '2.4.x', '2.5.x', '2.6.x', '2.7.x', '9.9.x' ].indexOf(rubyExt);

let newPath = process.env['PATH'].replace(/[^;]+?(Chocolatey|CMake|mingw64|OpenSSL|Strawberry|tools\\php)[^;]*;/g, '');

if (rubyExt !== '' && rubyIdx < 0) {
  core.setFailed(`Incorrect Ruby version: ${rubyExt}`);
}

const bits   = 64;
const prefix = (bits === 64) ? ' mingw-w64-x86_64-' : ' mingw-w64-i686-';

let rubyABIVers = '';

// Install Ruby versions from RubyInstaller (2.3.3) and RubyInstaller2 (2.4 and later)
async function installRubyWin() {

  const drive = (process.env['GITHUB_WORKSPACE'] || 'C')[0]

  // leave '' at end for Ruby master
  const ri2Fldrs  = ['ruby-2.3.3-x64-mingw32', 'RubyInstaller-2.4.9-1', 'RubyInstaller-2.5.7-1', 'RubyInstaller-2.6.5-1', 'RubyInstaller-2.7.0-1', ''];
  const rubyVersA = ['Ruby23-x64'            , 'Ruby24-x64'           , 'Ruby25-x64'           , 'Ruby26-x64'           , 'Ruby27-x64'           , 'Ruby99-x64'];

  const rubyHeadIdx = rubyVersA.length - 1;

  const ri2Fldr    = ri2Fldrs[rubyIdx];
  let   ri2FldrLwr = ri2Fldr.toLowerCase();

  const ri2URI = "https://github.com/oneclick/rubyinstaller2/releases/download";

  const rubyVers = rubyVersA[rubyIdx];

  if (rubyIdx === 0) {
    // Ruby 2.3 from RubyInstaller
    const uri = 'https://dl.bintray.com/oneclick/rubyinstaller/ruby-2.3.3-x64-mingw32.7z';
    const rubyPath = await tc.downloadTool(uri);
    await exec.exec(`7z x ${rubyPath} -o${drive}:\\`);
    fs.renameSync(`${drive}:\\${ri2FldrLwr}`, `${drive}:\\${rubyVers}`);
  } else if (rubyIdx < rubyHeadIdx) {
    // Ruby 2.4+ from RubyInstaller2, don't unzip doc files
    ri2FldrLwr += "-x64";
    const uri = `${ri2URI}/${ri2Fldr}/${ri2FldrLwr}.7z`;
    const rubyPath = await tc.downloadTool(uri);
    await exec.exec(`7z x ${rubyPath} -xr!${ri2FldrLwr}\\share\\doc -o${drive}:\\`);
    fs.renameSync(`${drive}:\\${ri2FldrLwr}`, `${drive}:\\${rubyVers}`);
    // core.exportVariable('SSL_CERT_FILE'   , `${drive}:/${rubyVers}/ssl/cert.pem`);
    // core.exportVariable('DEFAULT_CERT_DIR', `${drive}:/${rubyVers}/ssl/certs`);
  } else if (rubyIdx === rubyHeadIdx) {
    // ruby-loco (ruby master)
    const rubyPath = await tc.downloadTool('https://ci.appveyor.com/api/projects/MSP-Greg/ruby-loco/artifacts/ruby_trunk.7z');
    await exec.exec(`7z x ${rubyPath} -o${drive}:\\${rubyVers}`);
    // core.exportVariable('SSL_CERT_FILE'   , `${drive}:/${rubyVers}/ssl/cert.pem`);
    // core.exportVariable('DEFAULT_CERT_DIR', `${drive}:/${rubyVers}/ssl/certs`);
  } else {
    core.setFailed(`Incorrect Ruby version: ${rubyVers}`);
  }
  newPath = `${drive}:/${rubyVers}/bin;${newPath}`;
}

// Removes extra Ruby and other items from path, add mSYS2 items
function addPath() {
  const dirMingw  = `C:/msys64/mingw${bits}`;
  const dirUsr    = 'C:/msys64/usr';
  const dirMingwU = `/c/msys64/mingw${bits}`;
  const dirUsrU   = '/c/msys64/usr';
  if (rubyExt !== '') {
    // regex to match Ruby\2.5.5\x64\bin
    newPath = newPath.replace(/[^;]+Ruby\\\d\.\d+\.\d+\\x64\\bin;/, '');
  }

  child.execSync(`mklink /D C:\\msys64 ${msys2Loc}`);

  newPath = `C:/Program Files/7-Zip;${newPath}`;

  newPath = `${dirMingw}/bin;${dirUsr}/bin;${newPath}`;

  //core.exportVariable('MSYSTEM', `MINGW${bits}`);
}

// Install OpenSSL 1.0.2 for Ruby 2.3 & 2.4, 1.1.1 for Ruby 2.5 and later
async function openssl() {
  if (rubyABIVers >= '2.5') {
    const openssl = `${prefix}openssl`;
    await exec.exec(`pacman.exe -S ${args} ${openssl}`);
  } else {
    const openssl_2_4 = `https://dl.bintray.com/larskanis/rubyinstaller2-packages/${prefix.trim()}openssl-1.0.2.t-1-any.pkg.tar.xz`;
    const openssl_2_4_path = await tc.downloadTool(openssl_2_4);
    await exec.exec(`pacman.exe -Udd --noconfirm --noprogressbar ${openssl_2_4_path}`);
  }
}

// Updates MSYS2 MinGW gcc items
async function updateGCC() {
  // full update, takes too long
  //await exec.exec(`pacman.exe -Syu ${args}`);
  //await exec.exec(`pacman.exe -Su  ${args}`);
  let gccPkgs = ['', 'binutils', 'crt', 'dlfcn', 'headers', 'libiconv', 'isl', 'make', 'mpc', 'mpfr', 'windows-default-manifest', 'libwinpthread', 'libyaml', 'winpthreads', 'zlib', 'gcc-libs', 'gcc'];
  await exec.exec(`pacman.exe -S ${args} ${gccPkgs.join(prefix)}`);
}

// Updates MSYS2 package databases, call updateGCC when base value is 'update'
async function runBase() {
  // setup and update MSYS2
  await exec.exec(`bash.exe -c "pacman-key --init"`);
  await exec.exec(`bash.exe -c "pacman-key --populate msys2"`);
  await exec.exec(`pacman.exe -Sy`);

  if (base.includes('update')) { await updateGCC(); };
}

// Install MinGW packages from mingw input
async function runMingw() {
  if (mingw.includes('openssl')) {
    await openssl();
    mingw = mingw.replace(/openssl/gi, '').trim();
  }
  // remove bad characters (external input on command line)
  mingw = mingw.replace(/[^a-z_ \d\.\-]+/gi, '').trim();
  if (mingw !== '') {
    let pkgs = mingw.split(/ +/);
    if (pkgs.length > 0) {
      pkgs.unshift('');
      await exec.exec(`pacman.exe -S ${args} ${pkgs.join(prefix)}`);
    }
  }
}

// Install MYS2 packages from mys2 input
async function runMSYS2() {
  msys2 = msys2.replace(/[^a-z_ \d\.\-]+/gi, '').trim();
  if (msys2 !== '') {
    await exec.exec(`pacman.exe -S ${args} ${msys2}`);
  }
}

async function run() {
  try {
    if (IS_WINDOWS) {
      addPath();
      await installRubyWin();
      core.exportVariable('PATH', newPath);
      core.exportVariable('CI', 'true');
      rubyABIVers = child.execSync(`ruby.exe -e "STDOUT.write RbConfig::CONFIG['ruby_version']"`).toString().trim();
      if (base  !== '') { await runBase()  };
      if (mingw !== '') { await runMingw() };
      if (msys2 !== '') { await runMSYS2() };
    } else {
      const installDir = tc.find('Ruby', rubyExt);
      if (!installDir) {
          throw new Error(`Version ${rubyExt} not found`);
      }
      const toolPath = path.join(installDir, 'bin');
      if (!IS_WINDOWS) {
          // change shebang line in binstubs
          const dest = '/usr/bin/ruby';
          exec.exec('sudo ln', ['-sf', path.join(toolPath, 'ruby'), dest]); // replace any existing
      }
      core.addPath(toolPath);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}
run();

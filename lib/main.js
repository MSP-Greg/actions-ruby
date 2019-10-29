'use strict';

const core  = require('@actions/core');
const exec  = require('@actions/exec');
const tc    = require('@actions/tool-cache');

const child = require('child_process');
const fs    = require("fs");
const path  = require("path");

const args  = '--noconfirm --noprogressbar --needed';

const base    = core.getInput('base').trim().toLowerCase();
var   mingw   = core.getInput('mingw').trim().toLowerCase();
var   msys2   = core.getInput('msys2').trim().toLowerCase();
const rubyExt = core.getInput('ruby-version').trim();

const IS_WINDOWS = process.platform === 'win32';

const rubyIdx = [ '2.3.x', '2.4.x', '2.5.x', '2.6.x', '9.9.x' ].indexOf(rubyExt);

if (rubyExt !== '' && rubyIdx < 0) {
  core.setFailed(`Incorrect Ruby version: ${rubyExt}`);
}

const msys2Loc = core.getInput('msys2-loc');
const rubyDL   = "https://github.com/MSP-Greg/actions-ruby/releases/download/x64-mingw32";

const bits   = 64;
const prefix = (bits === 64) ? ' mingw-w64-x86_64-' : ' mingw-w64-i686-';

var rubyABIVers = '';

async function installRubyWin() {
  const rubyHeadIdx = 4;
  // leave '' at end for Ruby master
  const ri2Fldrs  = ['ruby-2.3.3-x64-mingw32', 'RubyInstaller-2.4.9-1', 'RubyInstaller-2.5.7-1', 'RubyInstaller-2.6.5-1', ''];
  const rubyVersA = ['Ruby23-x64'            , 'Ruby24-x64'           , 'Ruby25-x64'           , 'Ruby26-x64', 'Ruby99-x64'];

  const ri2URI = "https://github.com/oneclick/rubyinstaller2/releases/download";

  const rubyVers = rubyVersA[rubyIdx];
  const ri2Fldr  = ri2Fldrs[rubyIdx];
  var ri2FldrLwr = `${ri2Fldr.toLowerCase()}` ;

  if (rubyIdx === 0) {
    // Ruby 2.3 from RubyInstaller
    const uri = 'https://dl.bintray.com/oneclick/rubyinstaller/ruby-2.3.3-x64-mingw32.7z';
    const rubyPath = await tc.downloadTool(uri);
    await exec.exec(`7z x ${rubyPath} -oC:\\`);
    fs.renameSync(`C:\\${ri2FldrLwr}`, `C:\\${rubyVers}`);
  } else if (rubyIdx < rubyHeadIdx) {
    // Ruby 2.4+ from RubyInstaller2
    ri2FldrLwr += "-x64";
    const uri = `${ri2URI}/${ri2Fldr}/${ri2FldrLwr}.7z`;
    const rubyPath = await tc.downloadTool(uri);
    await exec.exec(`7z x ${rubyPath} -xr!${ri2FldrLwr}\\share\\doc -oC:\\`);
    fs.renameSync(`C:\\${ri2FldrLwr}`, `C:\\${rubyVers}`);
  } else if (rubyIdx === rubyHeadIdx) {
    // ruby-loco (ruby master)
    const rubyPath = await tc.downloadTool('https://ci.appveyor.com/api/projects/MSP-Greg/ruby-loco/artifacts/ruby_trunk.7z');
    await exec.exec(`7z x ${rubyPath} -oC:\\${rubyVers}`);
  } else {
    core.setFailed(`Incorrect Ruby version: ${rubyVers}`);
  }
  core.addPath(`C:\\${rubyVers}\\bin`);
}

function addPath() {
  const newPath = process.env['PATH'].replace(/[^;]+?(Chocolatey|CMake|mingw64|OpenSSL|Strawberry)[^;]*;/g, '');

  core.exportVariable('PATH', newPath);

  core.addPath('C:\\Program Files\\7-Zip');

  child.execSync(`mklink /D C:\\msys64 ${msys2Loc}`);

  core.addPath('C:\\msys64\\usr\\bin');
  core.addPath(`C:\\msys64\\mingw${bits}\\bin`);
  
  core.exportVariable('PKG_CONFIG_PATH', `/mingw${bits}/lib/pkgconfig:/mingw${bits}/share/pkgconfig`);
}

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

async function updateGCC() {
  // full update, takes too long
  //await exec.exec(`pacman.exe -Syu ${args}`);
  //await exec.exec(`pacman.exe -Su  ${args}`);
  let gccPkgs = ['', 'binutils', 'crt', 'headers', 'libiconv', 'isl', 'mpc', 'mpfr', 'windows-default-manifest', 'libwinpthread', 'winpthreads', 'zlib', 'gcc-libs', 'gcc'];
  await exec.exec(`pacman.exe -Sdd ${args} ${gccPkgs.join(prefix)}`);
}

async function runBase() {
  // setup and update MSYS2
  await exec.exec(`bash.exe -c "pacman-key --init"`);
  await exec.exec(`bash.exe -c "pacman-key --populate msys2"`);
  await exec.exec(`pacman.exe -Sy`);

  if (base.includes('update')) { await updateGCC(); };
}

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
      if (rubyExt !== '') { await installRubyWin(); };
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

'use strict';

const core  = require('@actions/core');
const exec  = require('@actions/exec');
const tc    = require('@actions/tool-cache');
const child = require('child_process');

const args  = '--noconfirm --noprogressbar --needed';

const base     = core.getInput('base').trim().toLowerCase();
const msys2    = core.getInput('msys2').trim().toLowerCase();
var   mingw    = core.getInput('mingw').trim().toLowerCase();
const rubyExt  = core.getInput('ruby-version').trim();

let i = [ '2.4.x', '2.5.x', '2.6.x', '9.9.x' ].indexOf(rubyExt);

if (i < 0) {
  core.setFailed(`Incorrect Ruby version: ${rubyExt}`);
}

const rubyVers = ['Ruby24-x64', 'Ruby25-x64', 'Ruby26-x64', 'Ruby99-x64'][i];

const msys2Loc = core.getInput('msys2-loc');
const rubyDL   = "https://github.com/MSP-Greg/actions-ruby/releases/download/x64-mingw32";

const bits   = rubyVers.endsWith('-x64') ? 64 : 32;
const prefix = (bits === 64) ? ' mingw-w64-x86_64-' : ' mingw-w64-i686-';

var rubyABIVers = '';

async function installRuby() {
  if (['Ruby24-x64', 'Ruby25-x64', 'Ruby26-x64'].includes(rubyVers)) {
    const rubyPath = await tc.downloadTool(`${rubyDL}/${rubyVers}.7z`);
    await exec.exec(`7z x ${rubyPath} -oC:\\${rubyVers}`);
  } else if ('Ruby99-x64' === rubyVers) {
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
  let gccPkgs = ['', 'binutils', 'crt', 'headers', 'iconv', 'isl', 'mpc', 'windows-default-manifest', 'libwinpthread', 'winpthreads', 'zlib', 'gcc-libs', 'gcc'];
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
  mingw = mingw.replace(/[^a-z0-9_\.\- ]+/gi, '').trim();
  if (mingw !== '') {
    // remove bad characters (external input on command line)
    let ary = mingw.split(/ +/);
    ary = ary.filter(i => i !== '');
    if (ary.length > 0) {
      ary.unshift('');
      await exec.exec(`pacman.exe -S ${args} ${ary.join(prefix)}`);
    }
  }
}

async function runMSYS2() {
  let pkgs = msys2.replace(/[^a-z0-9_\.\- ]+/gi, '').trim();
  if (pkgs.length > 0) { await exec.exec(`pacman.exe -S ${args} ${pkgs}`) };
}

async function run() {
  try {
    addPath();
    await installRuby();
    rubyABIVers = child.execSync(`ruby.exe -e "STDOUT.write RbConfig::CONFIG['ruby_version']"`).toString().trim();
    if (base  !== '') { await runBase()  };
    if (mingw !== '') { await runMingw() };
    if (msys2 !== '') { await runMSYS2() };
  } catch (error) {
    core.setFailed(error.message);
  }
}
run();

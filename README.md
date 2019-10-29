## MSP-Greg/actions-ruby  2019-10-31

### Brief Summary

The action is compatible with [actions/setup-ruby](https://github.com/actions/setup-ruby), and can be used with all OS's.

When the OS is Windows, it installs current Ruby versions, and also allows one to run jobs based on Ruby 2.3 or master.  Simple MYS2/DevKit operations are also included.

Othere OS's use the standard GitHub Actions Ruby versions.

### Usage

The following runs 12 jobs (3 OS's, 4 Rubies).  On Windows, it updates the MSYS2/DevKit gcc tools and installs the proper version of OpenSSL.
```yaml
jobs:
  ci:
    name: >-
      Ruby: ${{ matrix.ruby }}  OS: ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ 'ubuntu-18.04', 'macos', 'windows-latest' ]
        ruby: [ '2.3.x', '2.4.x', '2.5.x', '2.6.x' ]
    steps:
      - name: repo checkout
        uses: actions/checkout@v1
        with:
          fetch-depth: 10
      - name: Setup Ruby, update MSYS2
        uses: MSP-Greg/actions-ruby@master
        with:
          ruby-version: ${{ matrix.ruby }}
          base: update
          mingw: openssl
```

The following runs jobs using current versions of Ruby 2.4, 2.5 and 2.6, along with Ruby master.  It updates the gcc tools, and installs openssl & ragel.

```yaml
runs-on: 'windows-latest'
strategy:
  matrix:
    ruby: [ '2.4.x', '2.5.x', '2.6.x', '9.9.x' ]
steps:
- name: Install Ruby, update MSYS2
  uses: MSP-Greg/actions-ruby@master
  with:
    ruby-version: ${{ matrix.ruby }}
    base: update
    mingw: openssl ragel
```

The following runs jobs using current versions of Ruby 2.4, 2.5 and 2.6, along with Ruby master.  Other than adjusting the path for compiling extensions, nothing is done to MSYS2.

```yaml
runs-on: 'windows-latest'
strategy:
  matrix:
    ruby: [ '2.4.x', '2.5.x', '2.6.x', '9.9.x' ]
steps:
- name: Install Ruby
  uses: MSP-Greg/actions-ruby@master
  with:
    ruby-version: ${{ matrix.ruby }}
```

### How long does it take?

Installing current Rubies takes about 10 seconds for the GitHub hosted Rubies, about 15 - 20 seconds for ruby-head.

Installing current Rubies and updating the gcc tools takes +/- 2 minutes.

### General

This repo contains a GitHub action that will install current Ruby x64-mingw32 versions for use with GitHub Actions Windows images.

As of 2019-10-28, the versions available are:
```
actions-ruby     default
Ruby 2.3.3       not available
Ruby 2.4.9        2.4.6
Ruby 2.5.7        2.5.5
Ruby 2.6.5        2.6.3
```

Ruby master is also available, use '9.9.x' in the matrix.  At present, it is hosted on Appveyor, where it is built three times a day.  I intend to move it to GitHub in the near future.

All versions except master are RubyInstaller2 versions, with the html docs removed.  Removing the docs decreases the number of extracted files & folders by approx 2,400 items.

The matrix is compatible with the standard [`actions/setup-ruby@v1`](https://github.com/actions/setup-ruby) action published by GitHub.

### MSYS2 Issues

Actions' current mingw Rubies were built with gcc 8.3.0.  The DevKit/MSYS2 installs contain gcc 7.2.0. A new or updated MSYS2 installation uses gcc is 9.2.0.

The Ubuntu 16.04 Rubies were built with gcc 5.4.0, Ubuntu 18.04 Rubies were built with gcc 7.4.0.

So, if you'd like to use a curent gcc compiler, updating the MSYS2 gcc tools to 9.2.0 is the easiest way to do so.

For reference, see [MSP-Greg/github-actions-ruby-info](https://github.com/MSP-Greg/github-actions-ruby-info/actions) for information on current GitHub Actions Rubies.  Ubuntu 16.04 & 18.04, macOS, and windows-latest are shown.

### Ruby 2.3.3

Ruby 2.3.3 was built with a proprietary version of MSYS.  Generally, an *.so file shouldn't be incompatible with other files built with different tools.

### Why master?

Since the Ruby versions may change (think Christmas), using master means that use in CI doesn't need to change versions every year...

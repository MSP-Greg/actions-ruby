## MSP-Greg/actions-ruby

### Usage

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

The following runs jobs using current versions of Ruby 2.4, 2.5 and 2.6, along with Ruby master.  Other than adjusting the path for Ruby extension building, nothing is done to MSYS2.

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

Installing current rubies takes about 10 seconds for the GihHub hosted rubies, about 15 - 20 seconds for ruby-head.

Installing current rubies and updating the gcc tools takes approx 2 minutes.

### General

This repo contains a GitHub action that will install current Ruby x64-mingw32 versions for use with GitHub Actions windows images (GHAW).

As of 2019-10-28, the versions available are:
```
actions-ruby     default
Ruby 2.4.9        2.4.6
Ruby 2.5.7        2.5.5
Ruby 2.6.5        2.6.3
```
The files are hosted as a release in this repo.

Ruby master is also available, use '9.9.x' in the matrix.  At present, it is hosted on Appveyor, where it is built three times a day.  I intend on moving it to GitHub in the near future.

All versions except master are RubyInstaller2 versions, with the html docs removed.  Removing the docs drops the size of the download by about 3 MB, and also decreases the number of extracted files & folders by approx 2,400 items.

The matrix is compatible with the standard [`actions/setup-ruby@v1`](https://github.com/actions/setup-ruby) action published by GitHub.

### MSYS2 Issues

The current GHAW rubies were built with gcc 8.3.0.  The current DevKit/MSYS2 installs contain gcc 7.2.0. Current MSYS2 gcc is 9.2.0.

The Ubuntu 16.04 rubies were built with gcc 5.4.0, Ubuntu 18.04 rubies were built with gcc 7.4.0.

So, if you'd like to use a curent gcc compiler, updating the MSYS2 gcc tools to 9.2.0 is the easiest way to do so.

For reference, see [MSP-Greg/github-actions-ruby-info](https://github.com/MSP-Greg/github-actions-ruby-info/actions) for information on current GitHub Actions rubies.  Ubuntu 16.04 & 18.04, macOS, and windows-latest are shown.

### Why master?

Since the Ruby versions may change (think Christmas),using master means that use in CI doesn't need to change version every year...

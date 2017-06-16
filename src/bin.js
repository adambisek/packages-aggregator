#!/usr/bin/env node

import commandLineArgs from 'command-line-args';
import run from './index';

const optionDefinitions = [{
  name: 'source',
  alias: 's',
  type: String,
  defaultValue: process.cwd(),
}, {
  name: 'tempDirectory',
  alias: 't',
  type: String,
  defaultValue: './temp',
}, {
  name: 'resultDirectory',
  alias: 'r',
  type: String,
  defaultValue: `${process.cwd()}/packages-aggregator`,
}, {
  name: 'filesPattern',
  alias: 'f',
  type: String,
}];
const options = commandLineArgs(optionDefinitions);
run(options);

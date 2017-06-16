/* eslint no-console: "off" */
import shelljs from 'shelljs';
import chalk from 'chalk';
import request from 'request';
import async from 'async';
import decompress from 'decompress';
import fs from 'fs';
import glob from 'glob';


// eslint-disable-next-line global-require, import/no-dynamic-require
const getPackage = path => require(`${path}/package`);

const getDependencies = ({ dependencies }) => dependencies;

const getNpmPackageUrl = (packageName, packageVersion) => {
  const result = shelljs.exec(`npm view ${packageName}@${packageVersion} dist.tarball`);
  const tarball = result.stdout;
  /*
   may be multiline string like this:
   cross-env@3.2.2 'https://registry.npmjs.org/cross-env/-/cross-env-3.2.2.tgz'
   cross-env@3.2.3 'https://registry.npmjs.org/cross-env/-/cross-env-3.2.3.tgz'
   cross-env@3.2.4 'https://registry.npmjs.org/cross-env/-/cross-env-3.2.4.tgz'
  */
  // eslint-disable-next-line no-useless-escape
  const res = /([^\']+)\'?\s?$/.exec(tarball);
  return res[res.length - 1]; // last one
};

const downloadFile = (url, targetFile, callback) => {
  request.get(url)
    .on('error', callback)
    .on('end', () => {
      setTimeout(callback, 1000); // timeout to let filesystem finish writing :/
    })
    .pipe(fs.createWriteStream(targetFile));
};

const handleSecondaryError = (err, originalCallback) => { // logs error, but supress it
  if (err) console.log(chalk.red(err));
  originalCallback();
};

const unpackFile = (file, targetDirectory, callback) => {
  decompress(file, targetDirectory)
    .then(() => callback());
};

const dirExists = path => fs.existsSync(path);

const createDir = (path) => {
  if (fs.existsSync(path)) return;
  fs.mkdirSync(path);
};

const createRelativePath = (file, directory) => {
  if (file.indexOf(directory) !== 0) {
    throw new Error(`Cannot relativize '${file}' to directory '${directory}'.`);
  }
  let relativePath = file.replace(directory, '');
  relativePath = relativePath.replace(/^\//, ''); // strip starting slash
  return relativePath;
};

const copyFile = (src, dest, callback) => {
  const readStream = fs.createReadStream(src);
  readStream.once('error', callback);
  readStream.once('end', callback);
  readStream.pipe(fs.createWriteStream(dest));
};

const extractFiles = (directory, targetDirectory, globPattern, callback) => {
  glob(`${directory}/${globPattern}`, {}, (err, files) => {
    if (err) return callback(err);
    async.eachSeries(files, (file, cb) => {
      const relativePath = createRelativePath(file, directory);
      createDir(targetDirectory);
      copyFile(file, `${targetDirectory}/${relativePath}`, cb);
    }, callback);
    return null;
  });
};

const run = ({
  source,
  tempDirectory,
  resultDirectory,
  filesPattern,
}) => {
  console.log(chalk.bgMagenta.bold.white('Analyzing your package.json...'));
  const dependencies = getDependencies(getPackage(source));
  console.log(chalk.bgMagenta.bold.white("I've found there dependencies:"));
  console.log(dependencies);
  createDir(tempDirectory);
  if (!dirExists(resultDirectory)) {
    console.log(chalk.red(`Result directory does not exists. Please make directory '${resultDirectory}'.`));
    return;
  }
  if (!filesPattern) {
    console.log(chalk.red('Files pattern was not specified.'));
    return;
  }

  async.eachOfSeries(dependencies, (version, packageName, callback) => {
    console.log(chalk.magenta(`Processing ${packageName} @ ${version}`));
    const url = getNpmPackageUrl(packageName, version);
    const downloadPath = `./${tempDirectory}/${packageName}-${version}.tgz`;
    const unpackDir = `./download/${packageName}-${version}`;
    const resultDir = `${resultDirectory}/${packageName}`;
    async.series([
      cb => downloadFile(url, downloadPath, err => handleSecondaryError(err, cb)),
      (cb) => {
        console.log(' -> package downloaded ...');
        cb();
      },
      cb => unpackFile(downloadPath, unpackDir, err => handleSecondaryError(err, cb)),
      (cb) => {
        console.log(' -> files unpacked ...');
        cb();
      },
      cb => extractFiles(`${unpackDir}/package`, resultDir, filesPattern, err => handleSecondaryError(err, cb)),
      (cb) => {
        console.log(' -> files extracted ...');
        console.log(' -> done');
        cb();
      },
    ], callback);
  }, (err) => {
    if (err) {
      console.log(chalk.red(`Ended with an error: ${err}`));
      return;
    }
    console.log(chalk.green('Successfully done.'));
  });
};

export default run;

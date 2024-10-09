#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import archiver from 'archiver'
import extPackageJson from '../package.json' with { type: 'json' }

const DEST_DIR = path.join(import.meta.dirname, '../dist');
const DEST_ZIP_DIR = path.join(import.meta.dirname, '../dist-zip');

const makeDestZipDirIfNotExists = () => {
  if(!fs.existsSync(DEST_ZIP_DIR)) {
    fs.mkdirSync(DEST_ZIP_DIR);
  }
}

const buildZip = (src, dist, zipFilename) => {
  console.info(`Building ${zipFilename}...`);

  const archive = archiver('zip', { zlib: { level: 9 }});
  const stream = fs.createWriteStream(path.join(dist, zipFilename));
  
  return new Promise((resolve, reject) => {
    archive
      .directory(src, false)
      .on('error', err => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
};

const main = () => {
  const zipFilename = `${extPackageJson.name}-v${extPackageJson.version}.zip`;

  makeDestZipDirIfNotExists();

  buildZip(DEST_DIR, DEST_ZIP_DIR, zipFilename)
    .then(() => console.info('OK'))
    .catch(console.err); 
};

main();

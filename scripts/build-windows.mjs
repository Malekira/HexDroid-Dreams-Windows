import {packager} from '@electron/packager';
import options from './packaging-options.js';
const paths=await packager(options);
for(const path of paths)process.stdout.write(path+'\n');

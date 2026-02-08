import { Dashboard } from './Dashboard';
import { Analysis } from './Analysis'; // We will create this next
import { BatchUpload } from './BatchUpload'; // And this
import { Reports } from './Reports'; // And this
import { History } from './History'; // And this

export { Dashboard, Analysis, BatchUpload, Reports, History };

// Temporary stub exports until we create the files
// This pattern of exporting individually and then re-exporting in index.ts avoids circular dependency issues
// but requires the files to exist.
// Since I created Dashboard.tsx, I need to create the other files as valid components or this index.ts will fail.

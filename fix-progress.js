const fs = require('fs');

// Read the file
let content = fs.readFileSync('App.tsx', 'utf8');

// Add progress view type
content = content.replace(
  "const [view, setView] = useState<'upload' | 'results' | 'history'>('upload');",
  "const [view, setView] = useState<'upload' | 'results' | 'history' | 'progress'>('upload');"
);

// Add import
content = content.replace(
  "import { SharedReportView } from './components/SharedReportView';",
  "import { SharedReportView } from './components/SharedReportView';\nimport { ProgressPage } from './components/ProgressPage';"
);

// Change setView to progress
content = content.replace(
  "setView('results'); // Switch to results view to show loader",
  "setView('progress'); // Switch to progress view to show analysis progress"
);

// Add progress case to renderView
content = content.replace(
  "                    />;\n        case 'history':",
  "                    />;\n        case 'progress':\n            return <ProgressPage\n                        sourceFileName={sourceFile?.name}\n                        targetFileName={targetFile?.name}\n                    />;\n        case 'history':"
);

// Fix the critical condition
content = content.replace(
  "if (errors.length > 0 && view === 'upload') {",
  "if (errors.length > 0 && view === 'upload' && !isLoading) {"
);

// Write back
fs.writeFileSync('App.tsx', content);
console.log('Fixed App.tsx successfully');

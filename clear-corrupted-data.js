// Clear corrupted localStorage data
// Run this in the browser console to fix the UUID issues

console.log('🧹 Clearing corrupted localStorage data...');

// Clear translationHistory
if (localStorage.getItem('translationHistory')) {
  localStorage.removeItem('translationHistory');
  console.log('✅ Cleared translationHistory');
}

// Clear sharedReports
if (localStorage.getItem('sharedReports')) {
  localStorage.removeItem('sharedReports');
  console.log('✅ Cleared sharedReports');
}

// Clear any other potentially corrupted data
const keysToClear = [
  'translationHistory',
  'sharedReports',
  'totalAnalyzedWords'
];

keysToClear.forEach(key => {
  if (localStorage.getItem(key)) {
    localStorage.removeItem(key);
    console.log(`✅ Cleared ${key}`);
  }
});

console.log('🎉 All corrupted data cleared!');
console.log('🔄 Please refresh the page to start fresh with proper UUIDs');

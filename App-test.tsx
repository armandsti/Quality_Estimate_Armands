import React from 'react';

function App() {
  console.log('App component is rendering');
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          QA Analysis Tool
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          If you can see this styled properly, Tailwind CSS is working!
        </p>
        <div className="p-4 bg-green-100 text-green-800 rounded-lg border border-green-200 mb-4">
          ✅ React is rendering successfully
        </div>
        <div className="p-4 bg-blue-100 text-blue-800 rounded-lg border border-blue-200 mb-4">
          🎨 Tailwind CSS should be working now
        </div>
        <button 
          onClick={() => alert('Button clicked! CSS is working!')}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Click me to test!
        </button>
      </div>
    </div>
  );
}

export default App;

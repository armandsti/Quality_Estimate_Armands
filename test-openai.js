// Test script for OpenAI integration
// Run with: node test-openai.js

const testData = [
  {
    name: "Perfect translation (should return [])",
    sourceText: "Hello world",
    targetText: "Bonjour le monde"
  },
  {
    name: "Translation with errors (should return error objects)",
    sourceText: "The quick brown fox jumps over the lazy dog",
    targetText: "Le rapide renard brun saute sur le chien paresseux"
  },
  {
    name: "Major grammatical error",
    sourceText: "I have been working here for five years",
    targetText: "J'ai travaillé ici pendant cinq ans" // Missing continuous aspect
  }
];

async function testOpenAI() {
  console.log('🧪 Testing OpenAI Integration with QA Riks\n');

  for (const test of testData) {
    console.log(`📝 Test: ${test.name}`);
    console.log(`   Source: "${test.sourceText}"`);
    console.log(`   Target: "${test.targetText}"`);

    try {
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceText: test.sourceText,
          targetText: test.targetText
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.log(`❌ Error: ${error}`);
      } else {
        const result = await response.json();
        console.log(`✅ Found ${result.length} issues:`);
        if (result.length > 0) {
          result.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue.errorCategory} (${issue.severity}): ${issue.description}`);
            console.log(`      Suggested: "${issue.suggestedCorrection}"`);
          });
        }
      }
    } catch (error) {
      console.log(`❌ Network error: ${error.message}`);
    }

    console.log(''); // Empty line between tests
  }

  console.log('🎉 OpenAI integration test completed!');
}

testOpenAI().catch(console.error);

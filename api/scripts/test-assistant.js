import axios from 'axios';

const API_URL = 'http://localhost:4000/assistant';
const PROJECT_ID = 'ai-ecommerce-65f1a2b3c4d5e6f7g8h9i0j1';

async function testAssistant() {
    try {
        console.log('Testing Assistant Summary...');
        const summaryRes = await axios.get(`${API_URL}/summary`, {
            params: { projectId: PROJECT_ID }
        });
        console.log('✅ Summary:', summaryRes.data.summary.slice(0, 100) + '...');

        console.log('Testing Assistant Query (Simple)...');
        const queryRes = await axios.post(`${API_URL}/query`, {
            projectId: PROJECT_ID,
            question: "How do I run this project?"
        });
        console.log('✅ Answer:', queryRes.data.answer);

        // Optional: Test Deep RAG if enabled (might take longer and cost money)
        // console.log('Testing Assistant Query (Deep RAG)...');
        // const deepRes = await axios.post(`${API_URL}/query`, {
        //   projectId: PROJECT_ID,
        //   question: "Explain the project structure",
        //   deep: true
        // });
        // console.log('✅ Deep Answer:', deepRes.data.answer);

    } catch (error) {
        console.error('❌ Assistant test failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

testAssistant();

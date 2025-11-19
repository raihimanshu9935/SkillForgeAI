import axios from 'axios';

const API_URL = 'http://localhost:4000/projects';
const USER_ID = '65f1a2b3c4d5e6f7g8h9i0j1'; // Same as import test

async function testRecommender() {
    try {
        console.log('Testing Recommender...');
        const res = await axios.get(`${API_URL}/suggest`, {
            params: { userId: USER_ID, limit: 3 }
        });

        console.log(`✅ Recommender returned ${res.data.length} suggestions:`);
        res.data.forEach((t, i) => {
            console.log(`${i + 1}. ${t.title} (Score: ${t.similarity})`);
            console.log(`   Reason: ${t.shortReason}`);
        });

    } catch (error) {
        console.error('❌ Recommender test failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

testRecommender();

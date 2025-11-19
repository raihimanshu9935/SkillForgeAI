import axios from 'axios';

const API_URL = 'http://localhost:4000/import';
const USER_ID = '65f1a2b3c4d5e6f7g8h9i0j1'; // Fake ID for testing

async function testImport() {
    try {
        console.log('Testing Resume Import...');
        const resumeRes = await axios.post(`${API_URL}/resume`, {
            userId: USER_ID,
            text: "I am a software engineer with experience in React, Node.js, and MongoDB. I also know Python and Docker."
        });
        console.log('✅ Resume Import successful:', resumeRes.data.skills);

        console.log('Testing GitHub Import...');
        const githubRes = await axios.post(`${API_URL}/github`, {
            userId: USER_ID,
            username: "octocat" // Use a known public user
        });
        console.log('✅ GitHub Import successful. Repos found:', githubRes.data.githubRepos.length);

    } catch (error) {
        console.error('❌ Import test failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

testImport();

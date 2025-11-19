import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:4000/projects';
const USER_ID = '65f1a2b3c4d5e6f7g8h9i0j1';
const TEMPLATE_ID = 'ai-ecommerce'; // One of the templates we saw earlier

async function testCodegen() {
    try {
        console.log('🚀 Triggering Project Generation...');
        const res = await axios.post(`${API_URL}/generate`, {
            userId: USER_ID,
            templateId: TEMPLATE_ID
        });

        const jobId = res.data.jobId;
        console.log(`✅ Job started. ID: ${jobId}`);

        // Poll for status
        let status = 'queued';
        let jobData;

        console.log('⏳ Polling for completion...');
        while (status !== 'done' && status !== 'failed') {
            await new Promise(r => setTimeout(r, 1000)); // wait 1s
            const jobRes = await axios.get(`${API_URL}/job/${jobId}`);
            jobData = jobRes.data;
            status = jobData.status;
            process.stdout.write('.');
        }
        console.log('\n');

        if (status === 'failed') {
            console.error('❌ Job failed:', jobData.logs);
            process.exit(1);
        }

        console.log('✅ Job completed!');
        console.log('Logs:', jobData.logs);
        console.log('Artifact Path:', jobData.artifactPath);

        // Try to download artifact
        if (jobData.artifactPath) {
            console.log('📥 Downloading artifact...');
            const artifactRes = await axios.get(`${API_URL}/artifact/${jobId}`, { responseType: 'stream' });
            const destPath = path.join(process.cwd(), 'downloaded_project.zip');
            const writer = fs.createWriteStream(destPath);
            artifactRes.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            console.log(`✅ Artifact downloaded to ${destPath}`);
        }

    } catch (error) {
        console.error('❌ Codegen test failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

testCodegen();

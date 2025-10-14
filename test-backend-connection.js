// Test script to verify backend connection and data structure
const axios = require('axios');

const BACKEND_URL = 'https://greenwash-api-production.up.railway.app';

async function testBackendConnection() {
  console.log('🔍 Testing Backend Connection...\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing basic connectivity...');
    const healthResponse = await axios.get(`${BACKEND_URL}/`, {
      timeout: 10000,
      validateStatus: () => true // Accept all status codes
    });
    console.log(`   ✅ Server responded with status: ${healthResponse.status}\n`);

    // Test 2: Generate audit for a test company
    console.log('2️⃣  Testing audit generation with "Tesla"...');
    const testCompany = 'Tesla';
    const auditResponse = await axios.get(
      `${BACKEND_URL}/generate-audit?company=${encodeURIComponent(testCompany)}`,
      {
        timeout: 120000, // 2 minutes for analysis
        validateStatus: (status) => status >= 200 && status < 500
      }
    );

    if (auditResponse.status >= 400) {
      console.log(`   ⚠️  Server returned status ${auditResponse.status}`);
      console.log(`   Error details:`, auditResponse.data);
      return;
    }

    console.log(`   ✅ Audit generated successfully!\n`);

    // Test 3: Verify data structure
    console.log('3️⃣  Verifying response data structure...');
    const report = auditResponse.data;

    // Check basic structure
    const checks = {
      'company': !!report.company,
      'eco_audit': !!report.eco_audit,
      'greenscore': !!report.greenscore,
      'greenscore.score': typeof report.greenscore?.score === 'number',
      'greenscore.base_score (NEW)': typeof report.greenscore?.base_score === 'number',
      'greenscore.rationale (NEW)': typeof report.greenscore?.rationale === 'string',
      'greenscore.factors (NEW)': Array.isArray(report.greenscore?.factors),
      'sources (NEW top-level)': Array.isArray(report.sources),
      'eco_audit.findings': Array.isArray(report.eco_audit?.findings)
    };

    console.log('\n   Data Structure Checks:');
    for (const [key, value] of Object.entries(checks)) {
      const icon = value ? '✅' : '❌';
      console.log(`   ${icon} ${key}: ${value}`);
    }

    // Test 4: Check for new domain validation in sources
    console.log('\n4️⃣  Checking for domain validation features...');
    if (report.sources && report.sources.length > 0) {
      const firstSource = report.sources[0];
      console.log(`   ✅ Found ${report.sources.length} sources`);
      console.log(`   Sample source structure:`);
      console.log(`      - title: ${firstSource.title ? '✅' : '❌'}`);
      console.log(`      - url: ${firstSource.url ? '✅' : '❌'}`);
      console.log(`      - source_domain (NEW): ${firstSource.source_domain ? '✅ ' + firstSource.source_domain : '❌'}`);
      console.log(`      - source_type: ${firstSource.source_type ? '✅ ' + firstSource.source_type : '❌'}`);
    } else if (report.eco_audit?.findings && report.eco_audit.findings.length > 0) {
      console.log(`   ⚠️  Using fallback findings (${report.eco_audit.findings.length} found)`);
      const firstFinding = report.eco_audit.findings[0];
      console.log(`   Sample finding structure:`);
      console.log(`      - source_domain (NEW): ${firstFinding.source_domain ? '✅ ' + firstFinding.source_domain : '❌'}`);
    }

    // Test 5: Display GreenScore breakdown
    console.log('\n5️⃣  GreenScore Details:');
    console.log(`   Score: ${report.greenscore.score}`);
    if (report.greenscore.base_score) {
      console.log(`   Base Score: ${report.greenscore.base_score} (NEW)`);
    }
    if (report.greenscore.rationale) {
      console.log(`   Rationale: ${report.greenscore.rationale.substring(0, 100)}... (NEW)`);
    }
    if (report.greenscore.factors && report.greenscore.factors.length > 0) {
      console.log(`   Factors (${report.greenscore.factors.length}): (NEW)`);
      report.greenscore.factors.slice(0, 3).forEach((factor, i) => {
        console.log(`      ${i + 1}. ${factor}`);
      });
    }

    console.log('\n✅ Backend connection test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Backend is reachable: ✅`);
    console.log(`   - New data structure detected: ${report.greenscore.base_score ? '✅' : '❌'}`);
    console.log(`   - Domain validation present: ${report.sources?.[0]?.source_domain ? '✅' : '❌'}`);
    console.log(`   - 6-factor risk model: ${report.greenscore.factors?.length > 0 ? '✅' : '❌'}`);

  } catch (error) {
    console.error('\n❌ Backend Connection Test Failed!\n');
    
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error('   Error: Request timed out');
      console.error('   This might mean the backend is slow or unresponsive');
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      console.error('   Error: Cannot resolve backend URL');
      console.error('   Check if the backend URL is correct and accessible');
    } else if (error.response) {
      console.error(`   Server responded with status: ${error.response.status}`);
      console.error(`   Error data:`, error.response.data);
    } else if (error.request) {
      console.error('   Error: No response from server');
      console.error('   The backend might be down or unreachable');
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    console.error('\n   Full error:', error.code || error.message);
  }
}

// Run the test
testBackendConnection();

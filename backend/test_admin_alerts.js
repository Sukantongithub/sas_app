/**
 * Test script for admin alert endpoints
 * Run: node test_admin_alerts.js
 */

const BASE_URL = 'http://localhost:5000/api';

// Test data - update with real admin and staff IDs from your database
const TEST_DATA = {
  adminToken: '', // Set this to a valid admin token
  staffIds: [], // Set this to valid staff member IDs
};

async function testAlertEndpoints() {
  try {
    console.log('🧪 Testing Admin Alert Endpoints...\n');

    if (!TEST_DATA.adminToken) {
      console.log('❌ Please set TEST_DATA.adminToken first');
      console.log('To get a token:');
      console.log('1. Login as admin via the web interface');
      console.log('2. Copy the token from localStorage');
      console.log('3. Paste it into TEST_DATA.adminToken\n');
      return;
    }

    // Test 1: Get alert types and priorities
    console.log('📋 Test 1: Get Alert Types & Priorities');
    const typesResponse = await fetch(`${BASE_URL}/notifications/admin/alert-types`, {
      headers: { Authorization: `Bearer ${TEST_DATA.adminToken}` },
    });
    const types = await typesResponse.json();
    console.log('Response:', JSON.stringify(types, null, 2));
    console.log('✅ Alert types retrieved\n');

    // Test 2: Get recipients list
    console.log('📋 Test 2: Get Recipients List');
    const recipientsResponse = await fetch(`${BASE_URL}/notifications/admin/recipients`, {
      headers: { Authorization: `Bearer ${TEST_DATA.adminToken}` },
    });
    const recipients = await recipientsResponse.json();
    console.log(`Found ${recipients.total} staff member(s):`);
    recipients.recipients?.forEach((r) => {
      console.log(`  - ${r.name} (${r.email}) [${r._id}]`);
    });

    if (recipients.recipients.length === 0) {
      console.log('⚠️  No staff members found. Cannot proceed with alert tests.\n');
      return;
    }

    // Use first staff member for testing
    const testStaffIds = recipients.recipients.slice(0, 2).map(r => r._id);
    console.log(`✅ Recipients retrieved (using ${testStaffIds.length} for testing)\n`);

    // Test 3: Send alert
    console.log('📋 Test 3: Send Alert');
    const sendResponse = await fetch(`${BASE_URL}/notifications/admin/send-alert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_DATA.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientIds: testStaffIds,
        title: 'Test Alert - Meeting Scheduled',
        message: 'A staff meeting has been scheduled for tomorrow at 2 PM in Conference Room A.',
        priority: 'high',
        type: 'meeting_alert',
      }),
    });
    const sendResult = await sendResponse.json();
    console.log('Response:', JSON.stringify(sendResult, null, 2));
    
    if (sendResponse.ok) {
      console.log(`✅ Alert sent to ${sendResult.sent} staff member(s)\n`);
    } else {
      console.log('❌ Failed to send alert\n');
      return;
    }

    // Test 4: Get send history
    console.log('📋 Test 4: Get Alert Send History');
    const historyResponse = await fetch(
      `${BASE_URL}/notifications/admin/send-history?limit=10&skip=0`,
      {
        headers: { Authorization: `Bearer ${TEST_DATA.adminToken}` },
      }
    );
    const history = await historyResponse.json();
    console.log(`Total alerts sent: ${history.total}`);
    if (history.alerts.length > 0) {
      console.log('Recent alerts:');
      history.alerts.slice(0, 3).forEach((alert) => {
        console.log(`  - [${alert.priority}] ${alert.title} (${new Date(alert.createdAt).toLocaleString()})`);
      });
    }
    console.log('✅ History retrieved\n');

    // Test 5: Get recipients with filters
    console.log('📋 Test 5: Get Recipients with Search Filter');
    const searchResponse = await fetch(
      `${BASE_URL}/notifications/admin/recipients?search=test`,
      {
        headers: { Authorization: `Bearer ${TEST_DATA.adminToken}` },
      }
    );
    const searchResults = await searchResponse.json();
    console.log(`Found ${searchResults.total} matching staff member(s)`);
    console.log('✅ Search filter working\n');

    console.log('🎉 All tests completed!');
    console.log('\n📝 Next Steps:');
    console.log('1. Verify alerts appear in staff notifications');
    console.log('2. Test different priority/type combinations');
    console.log('3. Test with bulk recipient list (10+ people)');
    console.log('4. Monitor server logs for [ALERT.SEND] entries');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testAlertEndpoints();

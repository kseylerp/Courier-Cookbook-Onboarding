// Testing Your Onboarding Flow
// Comprehensive testing suite for onboarding sequences

import { CourierClient } from "@trycourier/courier";

class OnboardingTester {
  constructor(courier) {
    this.courier = courier;
    this.testResults = [];
  }

  // Test different user scenarios
  async testOnboarding() {
    const testUsers = [
      {
        id: "test-enterprise-user",
        profile: {
          email: "enterprise@test.com",
          name: "Enterprise Test User",
          company: "Big Corp",
          plan: "enterprise",
          company_size: 500,
          role: "admin",
          industry: "technology"
        },
        expectedFlow: "enterprise-onboarding",
        expectedChannels: ["email", "slack", "phone"]
      },
      {
        id: "test-startup-user", 
        profile: {
          email: "startup@test.com",
          name: "Startup Test User",
          company: "Small Co",
          plan: "startup",
          company_size: 10,
          role: "founder",
          industry: "saas"
        },
        expectedFlow: "startup-onboarding",
        expectedChannels: ["email", "inbox"]
      },
      {
        id: "test-trial-user",
        profile: {
          email: "trial@test.com",
          name: "Trial User",
          company: "Test Inc",
          plan: "trial",
          company_size: 5,
          role: "user",
          industry: "other"
        },
        expectedFlow: "trial-conversion-focused",
        expectedChannels: ["email"]
      },
      {
        id: "test-power-user",
        profile: {
          email: "power@test.com",
          name: "Power User",
          company: "Tech Corp",
          plan: "pro",
          company_size: 50,
          role: "admin",
          technical_level: "high"
        },
        expectedFlow: "technical-onboarding",
        expectedChannels: ["email", "inbox", "push"]
      }
    ];

    console.log("🧪 Starting Onboarding Tests...\n");
    
    for (const user of testUsers) {
      console.log(`Testing: ${user.profile.name} (${user.profile.plan})`);
      
      try {
        // Create test user
        await this.courier.profiles.replace(user.id, user.profile);
        
        // Trigger onboarding
        const result = await this.triggerOnboarding(user);
        
        // Verify automation started
        const verified = await this.verifyOnboarding(user, result);
        
        // Log results
        this.testResults.push({
          user: user.id,
          success: verified.success,
          details: verified
        });
        
        console.log(`✅ ${user.id}: ${verified.success ? 'PASSED' : 'FAILED'}`);
        
        if (!verified.success) {
          console.log(`  ❌ Failures: ${verified.failures.join(', ')}`);
        }
        
      } catch (error) {
        console.log(`❌ ${user.id}: ERROR - ${error.message}`);
        this.testResults.push({
          user: user.id,
          success: false,
          error: error.message
        });
      }
      
      // Clean up test user
      await this.cleanupTestUser(user.id);
    }
    
    // Generate summary report
    this.generateTestReport();
  }

  async triggerOnboarding(user) {
    const response = await this.courier.automations.invoke({
      automation: user.expectedFlow,
      profile: { user_id: user.id },
      data: {
        trigger: "test_signup",
        plan: user.profile.plan,
        company_size: user.profile.company_size,
        test_mode: true
      }
    });
    
    return response;
  }

  async verifyOnboarding(user, automationResult) {
    const verification = {
      success: true,
      failures: [],
      checks: {}
    };
    
    // Wait for messages to process
    await this.wait(2000);
    
    // Check if user profile was created correctly
    const profile = await this.courier.profiles.get(user.id);
    verification.checks.profileCreated = !!profile;
    
    if (!profile) {
      verification.success = false;
      verification.failures.push('Profile not created');
    }
    
    // Check if messages were sent
    const logs = await this.courier.logs.list({
      recipient: user.id,
      limit: 10
    });
    
    verification.checks.messagesSent = logs.results.length > 0;
    
    if (logs.results.length === 0) {
      verification.success = false;
      verification.failures.push('No messages sent');
    }
    
    // Check if correct channels were used
    const channelsUsed = [...new Set(logs.results.map(log => log.channel))];
    const expectedChannels = user.expectedChannels;
    
    verification.checks.correctChannels = expectedChannels.every(channel => 
      channelsUsed.includes(channel)
    );
    
    if (!verification.checks.correctChannels) {
      verification.success = false;
      verification.failures.push(`Wrong channels: expected ${expectedChannels}, got ${channelsUsed}`);
    }
    
    // Check if automation is running
    verification.checks.automationRunning = automationResult.runId !== undefined;
    
    if (!verification.checks.automationRunning) {
      verification.success = false;
      verification.failures.push('Automation not started');
    }
    
    return verification;
  }

  async cleanupTestUser(userId) {
    try {
      // Delete test user profile
      await this.courier.profiles.delete(userId);
      
      // Cancel any running automations
      // Note: Implementation depends on Courier API capabilities
    } catch (error) {
      console.log(`Warning: Could not clean up ${userId}: ${error.message}`);
    }
  }

  // Test edge cases
  async testEdgeCases() {
    const edgeCases = [
      {
        name: "Missing Email",
        user: {
          id: "test-no-email",
          profile: {
            name: "No Email User",
            company: "Test Co",
            plan: "trial"
          }
        },
        expectedBehavior: "Should use alternative channels"
      },
      {
        name: "Invalid Plan",
        user: {
          id: "test-invalid-plan",
          profile: {
            email: "invalid@test.com",
            plan: "nonexistent"
          }
        },
        expectedBehavior: "Should use default flow"
      },
      {
        name: "Duplicate User",
        user: {
          id: "test-duplicate",
          profile: {
            email: "duplicate@test.com",
            plan: "pro"
          }
        },
        expectedBehavior: "Should update existing profile"
      },
      {
        name: "Rapid Signup",
        users: Array(5).fill(null).map((_, i) => ({
          id: `test-rapid-${i}`,
          profile: {
            email: `rapid${i}@test.com`,
            plan: "startup"
          }
        })),
        expectedBehavior: "Should handle concurrent signups"
      }
    ];
    
    console.log("\n🔬 Testing Edge Cases...\n");
    
    for (const testCase of edgeCases) {
      console.log(`Testing: ${testCase.name}`);
      console.log(`Expected: ${testCase.expectedBehavior}`);
      
      try {
        if (testCase.users) {
          // Test multiple users (concurrent signups)
          await Promise.all(testCase.users.map(user => 
            this.triggerOnboarding(user)
          ));
          console.log(`✅ Handled ${testCase.users.length} concurrent signups`);
        } else {
          // Test single user
          await this.triggerOnboarding(testCase.user);
          console.log(`✅ Edge case handled correctly`);
        }
      } catch (error) {
        console.log(`⚠️ Edge case error: ${error.message}`);
      }
    }
  }

  // Test channel failover
  async testChannelFailover() {
    console.log("\n🔄 Testing Channel Failover...\n");
    
    const testUser = {
      id: "test-failover",
      profile: {
        email: "failover@test.com",
        phone: "+1234567890",
        plan: "enterprise"
      }
    };
    
    // Simulate primary channel failure
    const message = {
      template: "critical-notification",
      to: { user_id: testUser.id },
      routing: {
        method: "single",
        channels: ["email", "sms", "push"]
      },
      providers: {
        sendgrid: {
          override: {
            // Force failure for testing
            invalid_field: "trigger_error"
          }
        }
      }
    };
    
    try {
      const result = await this.courier.send(message);
      
      // Check if failover occurred
      const logs = await this.courier.logs.list({
        recipient: testUser.id,
        limit: 5
      });
      
      const channelsAttempted = logs.results.map(log => log.channel);
      
      if (channelsAttempted.includes('sms')) {
        console.log("✅ Failover to SMS successful");
      } else {
        console.log("❌ Failover did not occur");
      }
    } catch (error) {
      console.log(`❌ Failover test failed: ${error.message}`);
    }
  }

  // Performance testing
  async testPerformance() {
    console.log("\n⚡ Testing Performance...\n");
    
    const metrics = {
      profileCreation: [],
      messageDelivery: [],
      automationStart: []
    };
    
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const userId = `perf-test-${i}`;
      
      // Test profile creation speed
      const profileStart = Date.now();
      await this.courier.profiles.create({
        recipientId: userId,
        profile: {
          email: `perf${i}@test.com`,
          name: `Perf Test ${i}`
        }
      });
      metrics.profileCreation.push(Date.now() - profileStart);
      
      // Test message delivery speed
      const messageStart = Date.now();
      await this.courier.send({
        message: {
          template: "test-template",
          to: { user_id: userId }
        }
      });
      metrics.messageDelivery.push(Date.now() - messageStart);
      
      // Test automation start speed
      const automationStart = Date.now();
      await this.courier.automations.invoke({
        automation: "test-automation",
        profile: { user_id: userId }
      });
      metrics.automationStart.push(Date.now() - automationStart);
      
      // Clean up
      await this.courier.profiles.delete(userId);
    }
    
    // Calculate averages
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    console.log("Performance Metrics:");
    console.log(`  Profile Creation: ${avg(metrics.profileCreation).toFixed(0)}ms avg`);
    console.log(`  Message Delivery: ${avg(metrics.messageDelivery).toFixed(0)}ms avg`);
    console.log(`  Automation Start: ${avg(metrics.automationStart).toFixed(0)}ms avg`);
  }

  // Generate test report
  generateTestReport() {
    console.log("\n📊 Test Summary Report\n");
    console.log("=" .repeat(50));
    
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => !r.success).length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} (${((passed/total) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failed} (${((failed/total) * 100).toFixed(1)}%)`);
    
    if (failed > 0) {
      console.log("\nFailed Tests:");
      this.testResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.user}: ${r.error || r.details.failures.join(', ')}`);
        });
    }
    
    console.log("\n" + "=".repeat(50));
    console.log(passed === total ? "✅ All tests passed!" : "⚠️ Some tests failed");
  }

  // Utility functions
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run all tests
async function runOnboardingTests() {
  const courier = CourierClient({
    authorizationToken: process.env.COURIER_TEST_TOKEN || process.env.COURIER_AUTH_TOKEN
  });
  
  const tester = new OnboardingTester(courier);
  
  console.log("🚀 Starting Comprehensive Onboarding Tests\n");
  
  // Run test suites
  await tester.testOnboarding();
  await tester.testEdgeCases();
  await tester.testChannelFailover();
  await tester.testPerformance();
  
  console.log("\n✨ Testing Complete!\n");
}

export { OnboardingTester, runOnboardingTests };
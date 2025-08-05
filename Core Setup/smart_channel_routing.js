// Smart Channel Routing with Fallback Logic
// Configure intelligent routing across multiple channels

const sendWithRouting = async (courier, userId, notification) => {
  const routing = {
    // Always send to inbox for in-app visibility
    inbox: { 
      override: { 
        inbox: { 
          title: notification.title,
          preview: notification.preview,
          actions: notification.actions || []
        } 
      } 
    },
    
    // Email with smart fallback
    email: {
      override: {
        email: {
          subject: notification.subject,
          preheader: notification.preview,
          replyTo: notification.replyTo || "support@teamsync.com"
        }
      },
      if: { preferences: { channel: "email" } }
    },
    
    // SMS for critical actions only
    sms: {
      override: {
        sms: {
          body: notification.smsBody,
          from: process.env.TWILIO_PHONE_NUMBER
        }
      },
      if: { 
        AND: [
          { data: { priority: "critical" } },
          { profile: { phone_number: { exists: true } } }
        ]
      }
    },
    
    // Push for mobile users
    push: {
      override: {
        apn: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.preview,
              subtitle: notification.subtitle
            },
            badge: notification.badge || 1,
            sound: notification.sound || "default"
          }
        },
        fcm: {
          notification: {
            title: notification.title,
            body: notification.preview
          },
          data: notification.customData || {}
        }
      },
      if: { 
        OR: [
          { profile: { ios_push_token: { exists: true } } },
          { profile: { android_push_token: { exists: true } } }
        ]
      }
    },
    
    // WhatsApp for international users
    whatsapp: {
      override: {
        whatsapp: {
          body: notification.whatsappBody || notification.preview
        }
      },
      if: {
        AND: [
          { profile: { country: { not_equals: "US" } } },
          { profile: { whatsapp_number: { exists: true } } }
        ]
      }
    }
  };

  return await courier.send({
    message: {
      template: notification.template,
      to: { user_id: userId },
      data: notification.data,
      routing,
      timeout: {
        channel: 3600000, // 1 hour per channel
        provider: 300000  // 5 minutes per provider
      },
      escalation: {
        // Define escalation path
        channels: ["email", "sms", "push"],
        delay_between_channels: 1800000 // 30 minutes
      }
    }
  });
};

// Priority-based routing function
const sendByPriority = async (courier, userId, notification) => {
  const priorityConfig = {
    critical: {
      channels: ["sms", "push", "email", "inbox"],
      timeout: { channel: 300000 }, // 5 minutes
      retry: { attempts: 3, delay: 60000 }
    },
    high: {
      channels: ["email", "push", "inbox"],
      timeout: { channel: 1800000 }, // 30 minutes
      retry: { attempts: 2, delay: 300000 }
    },
    normal: {
      channels: ["email", "inbox"],
      timeout: { channel: 3600000 }, // 1 hour
      retry: { attempts: 1, delay: 600000 }
    },
    low: {
      channels: ["inbox"],
      timeout: { channel: 86400000 }, // 24 hours
      retry: { attempts: 0 }
    }
  };

  const config = priorityConfig[notification.priority || 'normal'];
  
  return await courier.send({
    message: {
      template: notification.template,
      to: { user_id: userId },
      data: notification.data,
      channels: config.channels,
      timeout: config.timeout,
      retry: config.retry
    }
  });
};

export { sendWithRouting, sendByPriority };
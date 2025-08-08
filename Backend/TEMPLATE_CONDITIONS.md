# Template Conditions Configuration

This document explains how to configure template conditions for the Gupshup WhatsApp API integration.

## Overview

Based on the Gupshup API URL example:
```
https://mediaapi.smsgupshup.com/GatewayAPI/rest?userid=2000254194&password={{PASSWORD}}&send_to=8714500637&v=1.1&format=json&msg_type=TEXT&method=SENDMESSAGE&msg=Hey%21+%F0%9F%91%8B+%0AEver+thought+of+running+a+business+that+helps+people+find+jobs%3F+%0AWith+EarlyJobs%2C+you+can+start+your+own+recruitment+franchise+-+no+experience+needed%21+%0A%E2%9C%85+Full+training+%26+support+%0A%E2%9C%85+Work+with+top+brands+like+HDFC+%0A%E2%9C%85+Help+freshers+%26+women+in+Tier+2-3+cities+It%E2%80%99s+simple%2C+impactful%2C+and+backed+by+smart+tools.+%0ALet%E2%80%99s+build+something+meaningful+together.&isTemplate=true&header=Lead+Hiring+in+Your+District+with+EarlyJobs%21&footer=EarlyJobs%3A+Build+Wealth%2C+Empower+Lives
```

## Template Parameters

### Required Parameters
- `userid`: Your Gupshup user ID
- `password`: Your Gupshup password
- `send_to`: Recipient phone number (without + prefix)
- `v`: API version (1.1)
- `format`: Response format (json)
- `msg_type`: Message type (TEXT)
- `method`: API method (SENDMESSAGE)
- `msg`: The main message content (URL encoded)
- `isTemplate`: Set to "true" for template messages

### Optional Parameters
- `header`: Template header text (max 60 characters)
- `footer`: Template footer text (max 60 characters)
- `templateId`: Unique template identifier
- `category`: Template category (e.g., MARKETING, UTILITY)
- `language`: Template language code (e.g., en, hi)

## Implementation

### 1. Enhanced GupshupService

The `GupshupService` now includes enhanced template handling:

```typescript
// Send template with conditions
const response = await GupshupService.sendTemplateMessageWithConditions(
  phoneNumber,
  {
    message: "Your message content",
    header: "Optional header",
    footer: "Optional footer",
    templateId: "unique_template_id",
    category: "MARKETING",
    language: "en",
    isTemplate: true
  }
);
```

### 2. Template Validation

Before sending, templates are validated for:
- Total message length (max 1024 characters)
- Header length (max 60 characters)
- Footer length (max 60 characters)
- Required fields (templateId, category, language)
- Phone number format

### 3. Error Handling

The service handles specific Gupshup error codes:
- `102`: Authentication failed (invalid userId or password)
- Other errors: Generic template errors with details

## Usage Examples

### Basic Template Message
```typescript
const templateData = {
  message: "Hey! 👋\nWelcome to EarlyJobs!",
  header: "Welcome Message",
  footer: "EarlyJobs: Build Wealth, Empower Lives",
  templateId: "welcome_message",
  category: "UTILITY",
  language: "en",
  isTemplate: true
};
```

### Marketing Template (from your example)
```typescript
const marketingTemplate = {
  message: "Hey! 👋\nEver thought of running a business that helps people find jobs?\nWith EarlyJobs, you can start your own recruitment franchise - no experience needed!\n✅ Full training & support\n✅ Work with top brands like HDFC\n✅ Help freshers & women in Tier 2-3 cities\nIt's simple, impactful, and backed by smart tools.\nLet's build something meaningful together.",
  header: "Lead Hiring in Your District with EarlyJobs!",
  footer: "EarlyJobs: Build Wealth, Empower Lives",
  templateId: "earlyjobs_franchise_opportunity",
  category: "MARKETING",
  language: "en",
  isTemplate: true
};
```

## API Endpoints

### Test Template Conditions
```http
POST /api/conversations/test-template
Content-Type: application/json
Authorization: Bearer <token>

{
  "phoneNumber": "8714500637",
  "templateData": {
    "message": "Your message",
    "header": "Optional header",
    "footer": "Optional footer",
    "templateId": "template_id",
    "category": "MARKETING",
    "language": "en",
    "isTemplate": true
  }
}
```

### Send Template Message
```http
POST /api/conversations/:id/messages
Content-Type: application/json
Authorization: Bearer <token>

{
  "type": "template",
  "content": {
    "templateId": "template_id",
    "templateData": {
      "variable1": "value1",
      "variable2": "value2"
    }
  }
}
```

## Testing

Use the provided test script:
```bash
npx ts-node scripts/testTemplateConditions.ts
```

This script will:
1. Validate template data
2. Create a manual template URL for debugging
3. Test the API endpoint (when configured)

## Environment Variables

Make sure these environment variables are set:
```env
GUPSHUP_TEMPLATE_USER_ID=your_user_id
GUPSHUP_TEMPLATE_PASSWORD=your_password
```

## Common Issues

### Authentication Error (102)
- Check your `GUPSHUP_TEMPLATE_USER_ID` and `GUPSHUP_TEMPLATE_PASSWORD`
- Ensure credentials are correct and active

### Template Validation Errors
- Message too long: Reduce content or split into multiple messages
- Missing required fields: Ensure templateId, category, and language are provided
- Invalid phone number: Use 10-15 digit format without + prefix

### URL Encoding
- Special characters in messages are automatically URL encoded
- Emojis are supported (UTF-8 encoded)
- Line breaks are converted to `%0A`

## Best Practices

1. **Template Design**
   - Keep headers and footers concise (max 60 characters)
   - Use clear, actionable language
   - Include relevant emojis for engagement

2. **Variable Handling**
   - Always provide fallback values for template variables
   - Validate variable content before sending
   - Use descriptive variable names

3. **Testing**
   - Test templates with different phone numbers
   - Verify message delivery and formatting
   - Monitor error responses for debugging

4. **Rate Limiting**
   - Respect Gupshup's rate limits
   - Implement retry logic for failed messages
   - Monitor API usage and costs 
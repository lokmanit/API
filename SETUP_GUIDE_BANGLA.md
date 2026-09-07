# 📞 লোকাল মেশিন সেটআপ ও মুম্বাই এজেন্ট কানেকশন গাইড (Bangla Guide)

এই গাইডটি অনুসরণ করে আপনি আপনার বাংলাদেশের লোকাল মেশিনে (ল্যাপটপ/পিসি/মিনি পিসি - শেয়ার্ড আইপিতে) এই টেলিকমিউনিকেশন এপিআই সিস্টেমটি ৫ মিনিটেই চালু করে মুম্বাই এজেন্ট সার্ভারের সাথে সংযুক্ত করতে পারবেন।

---

## 📋 ধাপ ১: ফাইল ডাউনলোড ও এক্সট্রাক্ট করা

1. Google AI Studio এর উপরে ডানপাশের **Settings (⚙️)** বা **Three Dots (⋮)** মেনু থেকে **"Export to ZIP"** বা **"Download Code"** ক্লিক করে ডাউনলোড করুন।
2. জিপ ফাইলটি আপনার কম্পিউটারে আনজিপ করুন এবং সেই ফোল্ডারে টার্মিনাল (Terminal / PowerShell) ওপেন করুন:
   ```bash
   cd your-downloaded-folder
   ```

---

## ⚙️ ধাপ ২: এক ক্লিকে ইনস্টলেশন (Ubuntu / Debian / macOS)

ফোল্ডারে গিয়ে নিচের কমান্ডটি দিলেই স্বয়ংক্রিয়ভাবে প্যাকেজ ও ডিরেক্টরি সেটআপ হয়ে যাবে:

```bash
chmod +x setup.sh && ./setup.sh
```

*(যদি উইন্ডোজ ব্যবহার করেন, তবে নিচের ৩টি সাধারণ কমান্ড রান করুন)*:
```powershell
npm install
npm run dev
```

---

## 🔑 ধাপ ৩: আপনার SIP পাসওয়ার্ড চেক ও সার্ভার চালু করা

ফোল্ডারের ভেতরে `.env` ফাইলটি নোটপ্যাড বা ভিএস কোডে খুলুন। সেখানে আপনার RanksTel একাউন্টের তথ্য ইতিমধ্যেই রেডি করা আছে:

```env
API_AUTH_TOKEN="call_api_sec_token_9f8d7c6b5a4"
TELEPHONY_PROVIDER="real"
SIP_SERVER="202.40.176.2"
SIP_PORT="5060"
SIP_USERNAME="09617552229"
SIP_PASSWORD="your_rankstel_password_here"
SIP_CALLER_ID="09617552229"
```

সার্ভার চালু করতে টার্মিনালে লিখুন:
```bash
npm run dev
```
সার্ভারটি লোকাল পোর্টে চালু হবে: `http://localhost:3000`

---

## 🌐 ধাপ ৪: মুম্বাই এজেন্ট সার্ভারের সাথে শেয়ার্ড আইপি কানেক্ট করা (Cloudflare Tunnel)

যেহেতু আপনার লোকাল মেশিনে রিয়েল/স্ট্যাটিক আইপি নেই (শেয়ার্ড বা ব্রডব্যান্ড NAT আইপি), তাই মুম্বাই সার্ভারকে আপনার মেশিনে পৌঁছানোর জন্য ক্লাউডফ্লেয়ারের ফ্রি সিকিউর টানেল ব্যবহার করবেন। 

আপনার মেশিনে আরেকটি নতুন টার্মিনাল ট্যাব খুলে নিচের কমান্ডটি রান করুন:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

কমান্ডটি দেওয়ার সাথে সাথে টার্মিনালে একটি ফ্রি পাবলিক HTTPS লিংক চলে আসবে, দেখতে ঠিক এমন:
```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://your-unique-subdomain.trycloudflare.com                                          |
+--------------------------------------------------------------------------------------------+
```

---

## 🤖 ধাপ ৫: মুম্বাই এজেন্ট সার্ভার থেকে কল পাঠানোর নিয়ম

এবার আপনার মুম্বাইয়ের এজেন্টিক সার্ভার কোড থেকে আপনার পাওয়া টানেল লিংকে নিচের মতো সাধারণ একটি `POST` রিকোয়েস্ট পাঠালেই কলটি আপনার বাংলাদেশের মেশিন হয়ে সরাসরি আপনার ফোনে চলে যাবে:

### cURL এক্সাম্পল:
```bash
curl -X POST https://your-unique-subdomain.trycloudflare.com/api/call \
  -H "Authorization: Bearer call_api_sec_token_9f8d7c6b5a4" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "+8801750010459",
    "content": "Emergency Alert from Mumbai Agent",
    "reason": "AGENT_TRIGGER"
  }'
```

### পাইথন (Python) কোড এক্সাম্পল (মুম্বাই এজেন্টের জন্য):
```python
import requests

url = "https://your-unique-subdomain.trycloudflare.com/api/call"
headers = {
    "Authorization": "Bearer call_api_sec_token_9f8d7c6b5a4",
    "Content-Type": "application/json"
}
payload = {
    "destination": "+8801750010459",
    "content": "Urgent alert from Mumbai AI Agent",
    "reason": "AI_AGENT_DECISION"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

### নোডজেএস (Node.js / TypeScript) এক্সাম্পল:
```javascript
const response = await fetch('https://your-unique-subdomain.trycloudflare.com/api/call', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer call_api_sec_token_9f8d7c6b5a4',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    destination: '+8801750010459',
    content: 'Urgent alert from Mumbai AI Agent',
    reason: 'AI_AGENT_DECISION'
  })
});

const data = await response.json();
console.log(data);
```

---

## 🛡️ ব্যাকগ্রাউন্ডে সবসময় চালু রাখার উপায় (Production PM2)

পিসি বন্ধ না করে যদি সার্ভারটিকে ২৪ ঘণ্টা ব্যাকগ্রাউন্ডে চালু রাখতে চান:

```bash
# PM2 ইনস্টল করুন (যদি না থাকে)
npm install -g pm2

# ব্যাকগ্রাউন্ডে সার্ভিস চালু করুন
pm2 start "npm run dev" --name "bd-telephony-bridge"

# স্ট্যাটাস চেক করুন
pm2 status
```
এখন আপনার টার্মিনাল ক্লোজ করে দিলেও ব্যাকগ্রাউন্ডে কল সার্ভিস চালু থাকবে!

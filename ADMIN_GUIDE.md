# CashWatch Admin Dashboard Guide

## 🎯 Quick Access
The Admin Dashboard is accessible from the **Wallet** tab for authorized admin users.

---

## 🎁 Creating Promo Codes

### Step-by-Step Instructions:

1. **Navigate to Admin Dashboard**
   - Go to Wallet tab
   - Admin users will see the Admin Dashboard option

2. **Open Promo Creator Tab**
   - Click on the **"Promo Creator"** tab in the admin navigation
   - You'll see a form to create new promo codes

3. **Fill in Promo Code Details**

   **Required Fields:**
   - **Promo Code*** (e.g., `WELCOME50`)
     - Enter a unique code name
     - Code will be automatically converted to UPPERCASE
     - Max 20 characters
   
   - **Per User Claim Amount (PAD)*** 
     - Amount of PAD each user receives when claiming
     - Example: `5000` = 5,000 PAD
     - This equals 0.05 TON or $0.05 USD

   **Optional Fields:**
   - **Max Users Allowed**
     - Total number of users who can claim this code
     - Leave empty for unlimited claims
     - Example: `100` = only 100 users can claim
   
   - **Expiry Date**
     - Date and time when the code expires
     - Leave empty for no expiration
     - Uses your browser's timezone
   
   - **Per User Claim Limit**
     - How many times each user can claim the code
     - Default: `1` (one claim per user)
     - Example: `3` = each user can claim 3 times

4. **Create the Code**
   - Click **"Create Promo Code"** button
   - Success message will appear if created successfully
   - Code will be added to the "Active Promo Codes" list below

### Example Promo Codes:

```
Code: WELCOME100
Amount: 10000 PAD
Max Users: 500
Per User Limit: 1
Expiry: None
→ First 500 users get 10,000 PAD once
```

```
Code: DAILY50
Amount: 5000 PAD
Max Users: Unlimited
Per User Limit: 1
Expiry: End of day
→ Everyone can claim 5,000 PAD once per day
```

```
Code: VIP1000
Amount: 100000 PAD
Max Users: 10
Per User Limit: 1
Expiry: 7 days
→ Only 10 VIP users get 100,000 PAD
```

### Active Promo Codes List

Below the creation form, you'll see all active promo codes with:
- **Code name**
- **Reward amount** (in PAD)
- **Claims count** (Claimed / Remaining)
- **Total PAD distributed**
- **Status** (Active/Inactive)
- **Expiry date** (if set)

---

## 🔍 User Tracking

### How to Search for Users:

1. **Navigate to User Tracking Tab**
   - Click on **"User Tracking"** tab in admin navigation

2. **Search by UID**
   - Enter the user's **UID** (referral code) in the search box
   - UID format: 6-digit number (e.g., `235650`)
   - Click **"Search User"** button

3. **View User Information**

   The user profile will display:

   **Account Details:**
   - **UID**: User's unique referral code
   - **Balance**: Current PAD balance
   - **Total Earnings**: All-time earnings in PAD
   - **Status**: Active or Banned

   **Activity Statistics:**
   - **Withdrawal Count**: Number of withdrawal requests made
   - **Referral Count**: Number of friends referred
   - **Ads Watched**: Total ads viewed by user
   - **Joined Date**: Account creation date

   **Wallet Information:**
   - **Current Wallet**: TON wallet address (if set)

### Finding User UIDs:

Users can find their UID in several places:
- **Home Page**: Displayed at the top (e.g., "UID: 235650")
- **Referral Link**: Part of their referral URL
- **User Profile**: Shows in account settings

### Use Cases for User Tracking:

1. **Verify User Complaints**
   - Search user by UID
   - Check balance and withdrawal history
   - Verify earnings and referrals

2. **Investigate Suspicious Activity**
   - Check ads watched count
   - Review referral count
   - Monitor withdrawal patterns

3. **Reward Top Users**
   - Find users with high referral counts
   - Create custom promo codes for VIP users

4. **Customer Support**
   - Quickly look up user accounts
   - Verify user claims
   - Provide accurate information

---

## 📊 Admin Dashboard Features

### 1. Withdrawals Tab
- **Pending Requests**: View and approve/reject withdrawal requests
- **Processed History**: See all approved and rejected withdrawals
- Enter transaction hash when approving payments

### 2. Analytics Tab
- **Active Users**: Daily active user count
- **Ads Watched**: Total ads viewed across platform
- **PAD Earned**: Total earnings distributed
- **Total Users**: Complete user base count
- **Withdrawal Analytics**: Request statistics
- **Platform Performance**: Growth charts

### 3. Promo Creator Tab
- Create and manage promotional codes
- View active promo code statistics
- Track distribution and usage

### 4. User Tracking Tab
- Search users by UID
- View detailed user profiles
- Monitor user activity

---

## 💡 Best Practices

### Promo Code Strategy:
1. **Welcome Codes**: Give new users a bonus to start (e.g., `WELCOME100`)
2. **Event Codes**: Create time-limited codes for special events
3. **VIP Codes**: Reward top users with exclusive high-value codes
4. **Daily Codes**: Engage users with daily bonus codes
5. **Referral Rewards**: Create codes for users who bring many friends

### User Tracking Tips:
1. Always verify user UIDs match their claims
2. Check multiple metrics before making decisions
3. Look for patterns in suspicious activity
4. Document your findings for future reference

### Security:
- Only share promo codes through official channels
- Monitor usage patterns to detect abuse
- Set appropriate limits on high-value codes
- Track code distribution carefully

---

## 🔧 API Endpoints (For Reference)

### Promo Code Management:
- `POST /api/promo-codes/create` - Create new promo code (admin only)
- `GET /api/admin/promo-codes` - Get all active promo codes (admin only)
- `POST /api/promo-codes/redeem` - Redeem a promo code (users)

### User Tracking:
- `GET /api/admin/user-tracking/:uid` - Search user by UID (admin only)

### Admin Stats:
- `GET /api/admin/stats` - Get platform statistics (admin only)

---

## 📝 Currency Conversion Reference

**PAD to TON to USD:**
- 100,000 PAD = 1 TON = $1.00 USD
- 10,000 PAD = 0.1 TON = $0.10 USD
- 1,000 PAD = 0.01 TON = $0.01 USD
- 100 PAD = 0.001 TON = $0.001 USD

**Example Promo Values:**
- 5,000 PAD = $0.05 (nickel bonus)
- 10,000 PAD = $0.10 (dime bonus)
- 50,000 PAD = $0.50 (half dollar bonus)
- 100,000 PAD = $1.00 (dollar bonus)

---

## ❓ FAQ

**Q: Can users claim the same promo code multiple times?**
A: Only if the "Per User Claim Limit" is set to more than 1.

**Q: What happens when a promo code reaches its max users?**
A: The code becomes inactive and no more users can claim it.

**Q: Can I delete or edit a promo code?**
A: Currently, codes cannot be edited or deleted after creation. Create a new code instead.

**Q: How do users redeem promo codes?**
A: Users click the "Promo" button on the home page and enter the code.

**Q: What if I can't find a user by their UID?**
A: Double-check the UID is correct. UIDs are 6-digit numbers shown to users on their home page.

**Q: Can I see who claimed a specific promo code?**
A: The current implementation shows total claims but not individual user details.

---

## 🚀 Quick Tips

1. **Test codes first**: Create a test code with small amounts to verify it works
2. **Set expiry dates**: Prevent old codes from being used indefinitely
3. **Limit high-value codes**: Use "Max Users Allowed" for expensive promotions
4. **Monitor regularly**: Check active codes daily to track usage
5. **Communicate clearly**: Tell users exact code names and expiry times

---

For technical support or questions, please contact the development team.

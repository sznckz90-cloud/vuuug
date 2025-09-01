import logging
import random
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, ContextTypes, filters
from config import BOT_TOKEN, ADMIN_ID, CHANNEL_ID, SUPPORT_LINK, CHANNEL_LINK, WEBAPP_URL, PAYMENT_METHODS, PER_AD_REWARD, STREAK_BONUS, DAILY_GOAL
from database import db
from datetime import datetime

# Enable logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# User states for conversation handling
(
    LANGUAGE_SELECTION,
    MATH_VERIFICATION,
    SUBSCRIPTION_CHECK,
    WITHDRAWAL_METHOD,
    WITHDRAWAL_ADDRESS,
    CONTEST_SUBMISSION,
    HELP_SECTION
) = range(7)

# Start command handler
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    message = update.message
    
    # Check if user exists in database, if not create
    user_data = db.get_user(user.id)
    if not user_data:
        # Check if this is a referral
        referral_code = None
        if context.args and len(context.args) > 0:
            referral_code = context.args[0]
            referred_by = db.get_user_by_referral_code(referral_code)
            if referred_by:
                db.create_user(user.id, user.username, user.first_name, user.last_name, referred_by=referred_by['id'])
            else:
                db.create_user(user.id, user.username, user.first_name, user.last_name)
        else:
            db.create_user(user.id, user.username, user.first_name, user.last_name)
    
    # Send welcome message
    await message.reply_text("Hey! I will help you upgrade your earn money by watching ads ✌")
    
    # Language selection
    keyboard = [
        [InlineKeyboardButton("🇷🇺 русский", callback_data='ru'),
         InlineKeyboardButton("🇪🇦 español", callback_data='es')],
        [InlineKeyboardButton("🇵🇹 Português", callback_data='pt'),
         InlineKeyboardButton("🇫🇷 français", callback_data='fr')],
        [InlineKeyboardButton("🇺🇿 o'zbek", callback_data='uz')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await message.reply_text("Current language 🇬🇧 English. Select language / Выбери язык", reply_markup=reply_markup)
    
    # Set state to language selection
    context.user_data['state'] = LANGUAGE_SELECTION

# Callback query handler
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user = query.from_user
    data = query.data
    
    # Language selection
    if data in ['ru', 'es', 'pt', 'fr', 'uz']:
        db.update_user_language(user.id, data)
        context.user_data['language'] = data
        
        # Generate math problem
        num1 = random.randint(1, 10)
        num2 = random.randint(1, 10)
        operator = random.choice(['+', '-'])
        problem = f"{num1} {operator} {num2}"
        answer = eval(problem)
        context.user_data['math_answer'] = answer
        
        await query.edit_message_text(text=f"To continue communication with me, please solve the task below 😉\n\n{problem} = ?")
        context.user_data['state'] = MATH_VERIFICATION
    
    # Subscription check
    elif data == 'check_subscription':
        try:
            member = await context.bot.get_chat_member(chat_id=CHANNEL_ID, user_id=user.id)
            if member.status in ['member', 'administrator', 'creator']:
                db.update_user_subscription(user.id, True)
                await query.edit_message_text("Thank you for subscribing! 🎉")
                await show_main_menu(update, context)
            else:
                await query.answer("Please subscribe to the channel first.", show_alert=True)
        except Exception as e:
            logger.error(f"Error checking subscription: {e}")
            await query.answer("Error verifying subscription. Please try again.", show_alert=True)
    
    # Withdrawal methods
    elif data.startswith('withdraw_'):
        method = data.replace('withdraw_', '')
        if method in PAYMENT_METHODS:
            await handle_withdrawal_method(update, context, method)
    
    # Help section
    elif data.startswith('help_'):
        topic = data.replace('help_', '')
        await show_help_topic(update, context, topic)
    
    # Contest participation
    elif data.startswith('contest_'):
        contest_type = data.replace('contest_', '')
        await handle_contest_participation(update, context, contest_type)
    
    # Back buttons
    elif data == 'back_to_help':
        await show_help_menu(update, context)
    elif data == 'back_to_account':
        await show_account(update, context)
    elif data == 'back_to_main':
        await show_main_menu(update, context)

# Message handler
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    message = update.message.text
    state = context.user_data.get('state', None)
    
    # Math verification
    if state == MATH_VERIFICATION:
        try:
            user_answer = int(message)
            if user_answer == context.user_data['math_answer']:
                await update.message.reply_text("Well, let's go? 🏄")
                await update.message.reply_text("Let's add the details to withdraw funds right away! If you do this later, then it will take several days to check the details")
                
                # Channel subscription check
                keyboard = [
                    [InlineKeyboardButton("🚀 Subscribe", url=CHANNEL_LINK)],
                    [InlineKeyboardButton("✅ I'm subscribed", callback_data='check_subscription')]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text("😉 Make sure you subscribe to our channel before you get started", reply_markup=reply_markup)
                
                context.user_data['state'] = SUBSCRIPTION_CHECK
            else:
                await update.message.reply_text("Incorrect answer. Please try again.")
        except ValueError:
            await update.message.reply_text("Please enter a number.")
    
    # Withdrawal address input
    elif state == WITHDRAWAL_ADDRESS:
        method = context.user_data['withdrawal_method']
        amount = context.user_data['withdrawal_amount']
        
        # Validate address based on method
        if validate_address(method, message):
            success, result = db.create_withdrawal(user.id, method, amount, message)
            if success:
                method_info = PAYMENT_METHODS[method]
                commission_text = f"Commission {method_info['name']}: "
                if method_info['commission_percent'] > 0:
                    commission_text += f"{method_info['commission_percent']}%"
                if method_info['commission_fixed'] > 0:
                    if method_info['commission_percent'] > 0:
                        commission_text += " + "
                    commission_text += f"{method_info['commission_fixed']} {method_info['currency']}"
                
                await update.message.reply_text(f"{commission_text}\nThe payout request has been successfully created and will be processed within an hour")
            else:
                await update.message.reply_text(f"Error: {result}")
        else:
            await update.message.reply_text("Invalid address format. Please check and try again.")
        
        # Return to account view
        await show_account(update, context)
        context.user_data['state'] = None
    
    # Contest submission
    elif state == CONTEST_SUBMISSION:
        contest_type = context.user_data['contest_type']
        
        # Validate URL
        if message.startswith('http://') or message.startswith('https://'):
            # Save submission to database
            db.create_contest_submission(user.id, contest_type, message)
            await update.message.reply_text("🕐 We are checking your participation, please wait!")
        else:
            await update.message.reply_text("Please enter a valid URL.")
        
        context.user_data['state'] = None
    
    # Default response for other messages
    else:
        if message == "💰 Earnings":
            await show_earnings(update, context)
        elif message == "👤 Account":
            await show_account(update, context)
        elif message == "⚙️ Settings":
            await show_settings(update, context)
        elif message == "🤩 Contest":
            await show_contest(update, context)
        elif message == "🌏 Language":
            await show_language_selection(update, context)
        elif message == "💬 Contact support":
            await contact_support(update, context)
        else:
            await update.message.reply_text("I didn't understand that. Please use the menu buttons.")

# Show main menu
async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [KeyboardButton("💰 Earnings"), KeyboardButton("👤 Account")],
        [KeyboardButton("⚙️ Settings"), KeyboardButton("🤩 Contest")]
    ]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    
    if hasattr(update, 'callback_query'):
        await update.callback_query.message.reply_text("Main menu:", reply_markup=reply_markup)
    else:
        await update.message.reply_text("Main menu:", reply_markup=reply_markup)
    
    context.user_data['state'] = None

# Show earnings
async def show_earnings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_stats = db.get_user_stats(user.id)
    
    if user_stats:
        today_earned = user_stats['earned_today'] or 0
        watched_today = user_stats['watched_today'] or 0
        streak_multiplier = user_stats['streak_multiplier'] or 1.0
        
        message = f"""🎬 Watch to Earn
🚀 Daily progress Goal: {DAILY_GOAL} Ads
👀 Watched Today: {watched_today}/ {DAILY_GOAL}
💰 Per Ad Reward: ${PER_AD_REWARD:.5f}
📅 Streak multiply: {streak_multiplier:.3f}X ({STREAK_BONUS:.3f}X added daily for consecutive claims, cumulatively multiplied on Per Ad Reward)
✨ Today You Earned: ${today_earned:.5f}
🤫Pro Tip: Keep your Daily Streak alive to multiply your rewards!"""
        
        keyboard = [[InlineKeyboardButton("💰 Get Paid Now", web_app=WebAppInfo(url=WEBAPP_URL))]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(message, reply_markup=reply_markup)

# Show account
async def show_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_stats = db.get_user_stats(user.id)
    
    if user_stats:
        message = f"""👤 My account
🆔 Telegram ID: {user_stats['telegram_id']}
📅 You are already with us: {user_stats['days_with_us']} days
💵 Balance: ${user_stats['balance']:.5f}
💰 Earned today: ${user_stats['earned_today']:.5f}
💰 Earned total: ${user_stats['earned_total']:.5f}
👥 Referrals: {user_stats['referral_count']}"""
        
        keyboard = [
            [InlineKeyboardButton("💰 Withdraw", callback_data='withdraw_menu')],
            [InlineKeyboardButton("👥 Referral link", callback_data='referral_link')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(message, reply_markup=reply_markup)

# Handle withdrawal menu
async def handle_withdrawal_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user = query.from_user
    user_stats = db.get_user_stats(user.id)
    
    if user_stats:
        available_balance = user_stats['balance']
        message = f"""👤 My account→ 💰 money
Available for withdrawal: ${available_balance:.5f}
Select Payment System"""
        
        keyboard = []
        for method_id, method_info in PAYMENT_METHODS.items():
            min_amount = method_info['min_amount']
            if available_balance >= min_amount:
                keyboard.append([InlineKeyboardButton(f"⭐ {method_info['name']}", callback_data=f'withdraw_{method_id}')])
        
        keyboard.append([InlineKeyboardButton("🔙 Back", callback_data='back_to_account')])
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(message, reply_markup=reply_markup)

# Handle withdrawal method selection
async def handle_withdrawal_method(update: Update, context: ContextTypes.DEFAULT_TYPE, method: str):
    query = update.callback_query
    await query.answer()
    
    user = query.from_user
    user_stats = db.get_user_stats(user.id)
    method_info = PAYMENT_METHODS[method]
    
    if user_stats:
        available_balance = user_stats['balance']
        min_amount = method_info['min_amount']
        
        if available_balance < min_amount:
            message = f"There are not enough funds on your balance. The minimum amount to withdraw to \"{method_info['name']}\" is {min_amount} {method_info['currency']}"
            await query.answer(message, show_alert=True)
            return
        
        # Store withdrawal method and amount in context
        context.user_data['withdrawal_method'] = method
        context.user_data['withdrawal_amount'] = available_balance
        
        # Ask for address
        prompt = ""
        if method == 'telegram_stars':
            prompt = "Enter your username or your friends (Example: @username)"
        elif method == 'crypto_bot':
            prompt = "Enter the Crypto Bot address."
        elif method == 'usdt_bep20':
            prompt = "Enter the Tether address."
        elif method == 'tron':
            prompt = "Enter the Tron address."
        elif method == 'litecoin':
            prompt = "Enter the Litecoin address."
        elif method == 'bitcoin_cash':
            prompt = "Enter the Bitcoin Cash address."
        elif method == 'dash':
            prompt = "Enter the Dash address."
        elif method == 'dogecoin':
            prompt = "Enter the Dogecoin address."
        elif method == 'ripple':
            prompt = "Enter the Ripple address."
        
        await query.edit_message_text(prompt)
        context.user_data['state'] = WITHDRAWAL_ADDRESS

# Show referral link
async def show_referral_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user = query.from_user
    user_stats = db.get_user_stats(user.id)
    referral_stats = db.get_referral_stats(user.id)
    
    if user_stats and referral_stats:
        referral_link = f"https://t.me/LightningSatsBot?start={user_stats['referral_code']}"
        
        message = f"""👥Total referrals: {referral_stats['total_referrals']}.
💪 Referrals who have watched at least one Ads: {referral_stats['active_referrals']}
🆕👥New referrals who joined in the last 30 days: {referral_stats['new_referrals_30']}
🆕💪New referrals who have joined in the last 30 days and have watched at least one Ad: {referral_stats['new_active_referrals_30']}
💸👥Your profit for the last 30 days, from all referrals: ${referral_stats['profit_30']:.5f}
💸🆕Your profit from referrals who have joined within the last 30 days: ${referral_stats['new_profit_30']:.5f}

For each ad watched by your referral, you will receive:
In the first month:
• Per Ad 0.000024
• Streak 0.0002
From the second month:
• Per Ad 0.000012
• Streak 0.0001

🔗Your referral link: {referral_link}"""
        
        keyboard = [[InlineKeyboardButton("🔙 Back", callback_data='back_to_account')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(message, reply_markup=reply_markup)

# Show settings
async def show_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [KeyboardButton("🌏 Language")],
        [KeyboardButton("💬 Contact support")],
        [KeyboardButton("🔔 Notifications")],
        [KeyboardButton("⚖️ Legal information")],
        [KeyboardButton("🔙 Back to Main Menu")]
    ]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    await update.message.reply_text("Settings:", reply_markup=reply_markup)

# Show language selection
async def show_language_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("🇷🇺 русский", callback_data='lang_ru'),
         InlineKeyboardButton("🇪🇦 español", callback_data='lang_es')],
        [InlineKeyboardButton("🇵🇹 Português", callback_data='lang_pt'),
         InlineKeyboardButton("🇫🇷 français", callback_data='lang_fr')],
        [InlineKeyboardButton("🇺🇿 o'zbek", callback_data='lang_uz')],
        [InlineKeyboardButton("🔙 Back", callback_data='back_to_settings')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Select language:", reply_markup=reply_markup)

# Contact support
async def contact_support(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton("📞 Contact via telegram", url=SUPPORT_LINK)]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Need help? If you have any questions about lightning sats, the service operator, or cooperation, write to us", reply_markup=reply_markup)

# Show contest
async def show_contest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = """Tell Others about Lightning Sats and get up to 10,000,000 Sats for each video

Create content: Make a fan video about the lightning sats app for YouTube short, instagram reel, or Tiktok.
Include your ID or invite link: Add your ID or invite link in the video description
Get your invite link in the profile section
Send the link: Once your video reaches 100+ views, send us the link
Earn rewards: The more views your video gets, the better your reward. You can earn up to 10,000,000 SATS for a single video.

Complete the tasks below to claim your $SATS:"""
    
    keyboard = [
        [InlineKeyboardButton("⚡ Create and share memes - 50,000 $SATS", callback_data='contest_meme')],
        [InlineKeyboardButton("🎥 YouTube Bonanza - 500,000 $SATS", callback_data='contest_youtube')],
        [InlineKeyboardButton("🔙 Back", callback_data='back_to_main')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(message, reply_markup=reply_markup)

# Handle contest participation
async def handle_contest_participation(update: Update, context: ContextTypes.DEFAULT_TYPE, contest_type: str):
    query = update.callback_query
    await query.answer()

    if contest_type == 'meme':
        message = """🔥 Airdrop - Create & Share Memes
👉🏻 Mission: Craft a meme about $BEES and share it in Telegram crypto groups. Get creative and showcase your humor!
❓ Share your meme in groups and press « ✅ Confirm »."""

        keyboard = [[InlineKeyboardButton("✅ Confirm", callback_data='contest_meme_confirm')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(message, reply_markup=reply_markup)

    elif contest_type == 'youtube':
        message = """🔥 Airdrop - YouTube Bonanza
👉🏻 Mission: Talk about $BEES and ClickBeeBot in YouTube videos/podcasts.
Cover topics like the token launch, its role in the ClickBee ecosystem, how users can earn crypto by completing tasks, and that tasks lead to token burns.
❓ Post your video on YouTube and press « ✅ Confirm »."""

        keyboard = [[InlineKeyboardButton("✅ Confirm", callback_data='contest_youtube_confirm')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(message, reply_markup=reply_markup)

    else:
        await query.answer("Unknown contest type")
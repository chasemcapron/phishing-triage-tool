// Holdout evaluation set (written 2026-10-14, frozen before its first run against the engine).
// US SMS and chat messages, modeled on 2024–2026 campaigns and on real service templates.
// Every phone number is a fictional 555-01xx number. Scam domains are invented: .example and
// .test stand in for ordinary .com names, and real campaign endings (.top, .xin, .vip, ...) are
// kept where the ending is part of the pattern. Legitimate messages use the real domains those
// senders use; names, codes, order and tracking numbers are made up. See README.md.
import type { EvalCase } from './types'

const scam = (id: string, text: string): EvalCase => ({ id: `S-${id}`, category: id.replace(/-\d+$/, ''), expect: 'flag', text })
const legit = (id: string, text: string): EvalCase => ({ id: `L-${id}`, category: id.replace(/-\d+$/, ''), expect: 'clean', text })

export const HOLDOUT_SCAMS: EvalCase[] = [
  // Unpaid tolls (the largest smishing wave of 2024–2025)
  scam(
    'toll-1',
    'E-ZPass Final Notice: Your vehicle has an outstanding toll of $4.35. To avoid a $50.00 late fee and suspension of your driving privileges, pay by October 17: https://e-zpassny.com-tollbill.xin/pay',
  ),
  scam(
    'toll-2',
    "SunPass: We've noticed an outstanding toll amount of $3.75 on your record. To avoid a late fee of $50.00, please visit https://sunpass.com-tollpay.icu/ to settle your balance.",
  ),
  scam(
    'toll-3',
    'FasTrak: Your account has an unpaid toll invoice of $6.80. Pay now to avoid additional fees and a DMV registration hold: https://bayareafastrak.org-invoice.vip/',
  ),
  scam('toll-4', 'NC Quick Pass: Your account has an unpaid toll balance of $11.70 due today. Avoid a $25 late fee: https://ncquickpass.com-billpay.top'),
  scam('toll-5', 'Illinois Tollway: You have an unpaid toll ($5.25). Pay within 12 hours to avoid penalties: illinoistollway-pay.example/inv'),
  scam(
    'toll-6',
    'TxTag: Your toll account shows an unpaid balance of $3.15. Reply Y, then exit and reopen this message to activate the link, or copy it into your browser: https://txtag.org-paybill.cfd/us',
  ),
  scam(
    'toll-7',
    'Toll Services: We noticed an outstanding toll on your vehicle. Pay $6.99 by 10/18 to avoid late fees and penalties: https://tolls-paycenter.example/inv?id=88213',
  ),

  // Package delivery
  scam(
    'delivery-1',
    'USPS: The package has arrived at the warehouse and cannot be delivered due to incomplete address information. Please confirm your address in the link within 12 hours. https://usps.com-redeliveryus.top/us (Please reply Y, then exit the SMS and open it again to activate the link, or copy the link into Safari)',
  ),
  scam(
    'delivery-2',
    'USPS Postal Notice: We were unable to deliver your parcel #US9524901185421 because the $0.30 shipping fee was not paid. Pay the redelivery fee here: https://uspostal-redeliver.example/fee',
  ),
  scam(
    'delivery-3',
    'FedEx: Your parcel is on hold at our facility due to unpaid customs duties ($1.99). Release it here: https://fedex-parcelhold.example/release',
  ),
  scam('delivery-4', 'UPS: Delivery attempt failed for package 1Z9X42E. Schedule a new delivery date: https://bit.ly/4UpsReDel'),
  scam(
    'delivery-5',
    'Amazon: Your delivery is delayed due to an address issue. Update your shipping details to avoid the package being returned: https://amzn-deliveryfix.example/order/113',
  ),
  scam('delivery-6', 'DHL: Your package is waiting for delivery. Please confirm the payment of $1.48 for shipping at: dhl-parcel-pay.example/confirm'),
  scam(
    'delivery-7',
    'Your parcel delivery failed and the package is being held at the distribution center. Reschedule delivery here: https://parcel-reschedule.example/id/8821',
  ),

  // Bank and payment-app fraud alerts
  scam(
    'bank-alert-1',
    'Chase Fraud Alert: A Zelle payment of $1,850.00 to ROBERT H was flagged. If you did not authorize this, cancel it here: https://chase.secure-zelle-review.example/cancel',
  ),
  scam(
    'bank-alert-2',
    'Bank of America: Unusual sign-in attempt detected on your account. If this was not you, secure your account now at bofa-secure-signin.example',
  ),
  scam(
    'bank-alert-3',
    'WellsFargo ALERT: Your debit card has been temporarily locked due to suspicious activity. Call our fraud department immediately at 1-833-555-0167.',
  ),
  scam(
    'bank-alert-4',
    'Navy Federal: We detected unusual activity on your account. Please verify your identity to restore access: https://navyfed-verify.example/login',
  ),
  scam(
    'bank-alert-5',
    'PayPal: You received a payment of $1,250.00 but it is on hold. Confirm your account to release the funds: https://paypal.com.release-funds.example',
  ),
  scam('bank-alert-6', 'Venmo: A transfer of $799.00 to your bank was initiated. Not you? Contact Venmo support at 1-888-555-0148 to stop the transfer.'),
  scam(
    'bank-alert-7',
    'Fraud Alert: Your debit card was used for $482.10 at Walmart. If this was not you, reply NO to block the card or visit https://cardservices-secure.example',
  ),

  // Account locked / verify
  scam(
    'account-1',
    'Apple Pay has been suspended on your device due to unusual activity. To keep using Apple Pay, verify your information at https://apple-pay-restore.example/verify',
  ),
  scam(
    'account-2',
    "NETFLIX: Your membership is on hold because we couldn't process your last payment. Update your billing details: https://netfIix-billing.example",
  ),
  scam(
    'account-3',
    'Outlook: Your mailbox storage is full and incoming messages are on hold. Sign in to upgrade your storage: https://outlook-mailbox-upgrade.example/owa',
  ),
  scam(
    'account-4',
    'Meta: Your Facebook page has been reported for copyright violation and will be disabled within 24 hours. Submit an appeal here: https://meta-business-appeal.example',
  ),
  scam(
    'account-5',
    'AT&T: Your account will be suspended today due to a billing error. Verify your payment information to avoid service interruption: https://att-billing-verify.example',
  ),
  scam('account-6', 'Google: Someone has your password. Review recent sign-in activity now: https://accounts.google.com.security-review.example/'),
  scam(
    'account-7',
    'Cash App: Your account has been flagged for a $650 suspicious transfer and is temporarily restricted. Log in to review: https://cash-app-review.example/login',
  ),

  // Tax and government
  scam(
    'government-1',
    'Pennsylvania DMV Final Notice: Enforcement Penalties Begin on October 20th. Our records indicate that as of today, you have an outstanding traffic ticket. Pay now to avoid license suspension, vehicle registration suspension and prosecution: https://pa.gov-dmvtickets.vip/pay',
  ),
  scam(
    'government-2',
    'IRS: Your 2025 tax refund of $1,147.20 is pending. Submit your bank details within 48 hours to receive the direct deposit: https://irs.gov.refund-status.example/claim',
  ),
  scam(
    'government-3',
    'Social Security Administration: Your SSN has been suspended due to suspicious activity. Call 1-877-555-0193 immediately to avoid legal action.',
  ),
  scam(
    'government-4',
    'Notice from the Clerk of Court: You missed jury duty on 10/06 and a warrant has been issued. To resolve this, pay the $350 fine at https://county-court-payments.example/fine',
  ),
  scam(
    'government-5',
    'Medicare: You are eligible for a new plastic Medicare card with a chip. Reply with your Medicare number and date of birth to receive it.',
  ),

  // Job and task scams
  scam(
    'job-1',
    'Hello, I am Ashley from Randstad recruiting. We are hiring remote online assistants, 1-2 hours a day, $200-$500 daily. If interested, contact me on WhatsApp: +1 (302) 555-0177',
  ),
  scam(
    'job-2',
    'Hi, this is Rachel with the HR department at Indeed. Your resume has been approved for a flexible part-time position. Pay is $70-$350 per day. Reply YES to learn more.',
  ),
  scam(
    'job-3',
    'Congratulations! You have been selected for an online product-rating job. Complete 40 tasks a day and earn $120-$900. Training is provided. Message our manager on Telegram: t.me/hr_tasks_amz',
  ),
  scam(
    'job-4',
    'Thank you for applying for the mystery shopper position. A check for $2,450 will be mailed to you. Deposit the check, keep $300 for your time and send the balance via Zelle to our vendor.',
  ),
  scam('job-5', 'Amazon HR: Part-time remote job available. Work from home 30 mins a day, daily pay $300. Apply here: https://amzn-careers-apply.example/form'),

  // Wrong number and pig butchering
  scam('wrong-number-1', "Hi David, it's Emma. Are we still meeting for coffee tomorrow at 10?"),
  scam('wrong-number-2', 'Hello, is this Jennifer? This is Mark, we met at the wine tasting in Napa last month.'),
  scam('wrong-number-3', "Are you free for golf this weekend, Mr. Thompson? My assistant said you'd be back from Chicago by Friday."),
  scam(
    'wrong-number-4',
    "Good afternoon. My name is Sophia, I'm a financial advisor. A friend gave me this number, sorry if I reached the wrong person. Do you know anything about gold futures?",
  ),
  scam(
    'wrong-number-5',
    "Since you asked, the platform I use is called Arbitrix. My aunt's team guarantees 30% monthly returns on USDT arbitrage. Register at arbitrix-trade.example with my invitation code 8816 and deposit at least $1000.",
  ),

  // Fake stores and deals
  scam('fake-store-1', 'Stanley Quencher 40oz warehouse clearance! Only $9.99, today only while supplies last. Order: https://stanley-cups-outlet.shop/'),
  scam('fake-store-2', 'Ray-Ban sunglasses 90% off, store closing sale, today only! https://rb-sunglasses-outlet.store'),
  scam(
    'fake-store-3',
    "Costco Members: You've been selected for a free 2-year membership renewal + $100 Costco Cash. Just pay $2.95 shipping: https://costco-members-rewards.example",
  ),

  // Prizes and rewards
  scam(
    'prize-1',
    'T-Mobile: Congratulations! Your 7,500 reward points expire tonight. Redeem them for a free Samsung Galaxy S25 before midnight: https://tmobile-rewards.example/redeem',
  ),
  scam(
    'prize-2',
    "Verizon: You've been randomly chosen for our customer loyalty gift. Take a 30-second survey to claim your Apple AirPods: https://vz-loyalty-survey.example/?id=443",
  ),
  scam('prize-3', 'Congrats! You won a $500 Walmart gift card in our weekly draw. Claim within 24 hours: https://tinyurl.com/wm-giftclaim'),

  // Romance and gift cards
  scam(
    'romance-1',
    "Babe I'm so sorry to ask again, the customs officer won't release my luggage until I pay the fee. Can you get two $250 Steam gift cards and text me the codes? I'll pay you back as soon as I land.",
  ),
  scam(
    'romance-2',
    "Hey love, my withdrawal from the trading platform is frozen until I pay a 10% release fee. Could you send $3,000 by wire transfer? I'll return it next week with interest.",
  ),

  // Family emergency
  scam(
    'family-1',
    "Grandma it's me, I got into a car accident and I'm at the police station. Please don't tell mom. I need $2,000 for bail, my lawyer will call you to explain.",
  ),
  scam(
    'family-2',
    "Hi Dad, I broke my phone so this is my new number. Can you send me $480 for the repair today? I'll pay you back, just Zelle it to my friend Kayla.",
  ),

  // One-time code relay
  scam(
    'code-relay-1',
    "Hi, this is the Coinbase security team. To stop the unauthorized withdrawal we just sent a verification code to your phone. Please reply with the code to confirm it's you.",
  ),
  scam('code-relay-2', "Hey! I'm locked out of my WhatsApp and it sent the code to your number by mistake. Can you send me the 6 digit code? Thanks!!"),

  // Callback and refund
  scam(
    'callback-1',
    'Amazon: Your order #112-8834190 for an iPhone 16 Pro Max ($1,299.00) has shipped. If you did not place this order, call 1-888-555-0129 to cancel.',
  ),
  scam(
    'callback-2',
    'PayPal: Your account was charged $599.99 for a Bitcoin purchase. If this was not you, contact PayPal Support at +1 (855) 555-0181 within 24 hours for a refund.',
  ),
  scam(
    'callback-3',
    'Norton LifeLock: Thank you for your payment of $349.99. Your plan will auto-renew today. To cancel and get a refund, call our billing desk: (866) 555-0102',
  ),

  // Crypto
  scam(
    'crypto-1',
    'Coinbase: A withdrawal request of 1.2 ETH to an unrecognized wallet was submitted. If you did not request this, secure your account at https://coinbase-withdrawal-cancel.example',
  ),
  scam(
    'crypto-2',
    'Exclusive: our AI trading bot earned members 4.7% daily this month. Join the VIP signal group and claim your 500 USDT bonus: https://t.me/+AiSignalsVIP',
  ),

  // Lookalikes of popular sites (not on the brand list)
  scam(
    'popular-lookalike-1',
    'Your coworker shared a file with you via Dropbox: Q4_Payroll_Adjustments.pdf. View it here: https://dropbox-docs-share.example/view?f=8812',
  ),
  scam('popular-lookalike-2', 'Steam: your friend sent you a gift! Accept the $50 Steam Wallet card here: https://steamcommunnity.example/gift/accept'),
  scam('popular-lookalike-3', 'Discord Nitro is free for 3 months for all users! Claim yours before it expires: https://discord-gifts-nitro.example/claim'),
  scam('popular-lookalike-4', "Canva: Jessica Miller shared a design with you: 'Invoice_Oct.pdf'. Open the design: https://canva-designs-portal.example"),

  // Link shorteners
  scam('shortener-1', 'Your Netflix payment failed. Update now to keep watching: https://rb.gy/x7k2pq'),
  scam('shortener-2', 'Your package is on hold due to an unpaid $1.25 delivery fee. Pay here: https://is.gd/pkgfee88'),

  // Evasion tricks
  scam('evasion-1', 'Apple ID locked for security reasons. Unlock it at appleid-unlock[dot]help to avoid losing your photos.'),
  scam('evasion-2', 'Chase: your card is restricted. Restore access at chase-verify . com/login (remove the spaces)'),
  scam('evasion-3', 'U.S.P.S: Your package is pending due to an unpaid shipping fee. Pay here: https://parcel-help-center.top/us'),
]

export const HOLDOUT_LEGIT: EvalCase[] = [
  // One-time codes
  legit('otp-1', "Your WhatsApp code: 482-913\nYou can also tap on this link to verify your phone: v.whatsapp.com/482913\nDon't share this code with others"),
  legit('otp-2', "804 271 is your Instagram code. Don't share it."),
  legit('otp-3', 'Your Uber code: 4821. Never share this code. Reply STOP ALL to +1 415-555-0103 to unsubscribe.'),
  legit('otp-4', '529304 is your Amazon OTP. Do not share it with anyone.'),
  legit('otp-5', "PayPal: Your security code is: 618422. Your code expires in 10 minutes. Please don't reply."),
  legit('otp-6', 'BofA: DO NOT share this code. We will NEVER call to ask for it. Code 774019 for online banking sign-in. Expires in 10 min.'),
  legit('otp-7', 'Your Discord security code is: 395820'),
  legit('otp-8', '[TikTok] 830211 is your verification code, valid for 5 minutes. To keep your account safe, never forward this code.'),
  legit(
    'otp-9',
    "Venmo here! NEVER share this code via call/text. ONLY YOU should enter the code. BEWARE: If someone asks for the code, it's a scam. Code: 502117",
  ),

  // Deliveries and orders
  legit('order-1', 'Amazon: Your package with Anker 65W USB-C Charger was delivered. See photo: https://a.co/d/3kXyZ9p'),
  legit(
    'order-2',
    'USPS: Expected Delivery on Wednesday, October 15, 2026 by 9:00pm 9405511206184421330725. Text 3 for more options. Reply STOP to cancel all USPS text updates.',
  ),
  legit('order-3', 'DoorDash: Your Dasher Maria is heading to you with your order from Chipotle. Track it here: https://www.doordash.com/orders/3f9a1c2e'),
  legit(
    'order-4',
    'FedEx: Package 774122130961 from Best Buy is scheduled for delivery today by 8 PM. Manage delivery: https://www.fedex.com/fedextrack/?trknbr=774122130961',
  ),
  legit(
    'order-5',
    'UPS: Your package from AMAZON.COM will be delivered today between 1:30 PM and 5:30 PM. Track: https://www.ups.com/track?tracknum=1Z4F98W20398451120',
  ),
  legit('order-6', "Walmart: Your order #2000123-45567 is ready for pickup at Store #1043. Check in when you're on your way: https://www.walmart.com/orders"),
  legit(
    'order-7',
    'Instacart: Your shopper Kevin has started shopping your Costco order. Chat or review replacements here: https://www.instacart.com/store/orders',
  ),
  legit('order-8', "Target: Your Drive Up order is ready! Tap when you're on your way: https://www.target.com/orders"),

  // Bank, card, payment and bill alerts
  legit(
    'bank-bill-1',
    'Chase Fraud Alert: Did you use card ending in 4417 for $9.99 at APPLE.COM/BILL on 10/14? Reply YES or NO. Msg & data rates may apply. Reply STOP to opt out.',
  ),
  legit('bank-bill-2', 'Wells Fargo: Your Zelle payment of $45.00 to JORDAN LEE was sent on 10/14. If you did not authorize this, call us at 1-800-555-0110.'),
  legit('bank-bill-3', 'Capital One: Your Quicksilver card ending in 2231 statement is now available. Min payment of $35.00 is due 10/28. View it in the app.'),
  legit('bank-bill-4', 'Discover: A transaction of $1,204.97 at BESTBUY.COM on card ending 6011 was declined. If you made it, reply 1. If not, reply 2.'),
  legit('bank-bill-5', 'Navy Federal: Your direct deposit of $2,318.40 has posted to checking ending 7721. Questions? Call 1-888-555-0177.'),
  legit(
    'bank-bill-6',
    'Bank of America: Your balance in account ending 4402 is below $100.00. Available balance: $86.12 as of 10/14. Manage alerts at bankofamerica.com/alerts',
  ),
  legit(
    'bank-bill-7',
    'American Express: Your payment of $428.19 was received on 10/13. Thank you for being a Card Member. View your account: https://www.americanexpress.com/',
  ),
  legit(
    'bank-bill-8',
    'Citi Alert: A $2.00 international transaction was charged to card ending 3328 at PAYPAL *STEAMGAMES. If this is unexpected, call 1-800-555-0144.',
  ),
  legit('bank-bill-9', 'T-Mobile: Your bill of $85.00 is scheduled for AutoPay on 10/21. View your bill: https://www.t-mobile.com/bill'),
  legit('bank-bill-10', 'Austin Energy: Your bill of $142.33 is due 10/20. Pay online at https://coautilities.com or reply PAY to use your saved card.'),

  // Appointments and services
  legit(
    'appointment-1',
    'Reminder: Your appointment with Dr. Alvarez at Lakeside Pediatrics is Wed 10/22 at 3:40 PM. Reply C to confirm or R to reschedule. Please arrive 15 minutes early.',
  ),
  legit(
    'appointment-2',
    'Walgreens: Your prescription is ready for pickup at 1500 Lamar Blvd. Pick up within 10 days or it will be returned to stock. Reply STOP to end texts.',
  ),
  legit('appointment-3', 'Quest Diagnostics: Your lab results are ready. View them securely at https://myquest.questdiagnostics.com'),
  legit('appointment-4', 'Jiffy Lube: Your 2019 Honda CR-V is due for an oil change. Book online: https://www.jiffylube.com/locations'),
  legit('appointment-5', "Great Clips: You're checked in! Estimated wait: 15 min. We'll text you when it's almost your turn. Reply STOP to opt out."),

  // School and civic
  legit('school-civic-1', 'Oakridge Middle School: Picture retakes are Thursday 10/23. Order photo packages online at https://my.lifetouch.com/'),
  legit(
    'school-civic-2',
    'ParentSquare: New message from Ms. Harper (3rd Grade): Field trip permission slips are due Friday. https://www.parentsquare.com/feeds/123456',
  ),
  legit(
    'school-civic-3',
    'City of Austin: Due to the storm, bulk trash collection is postponed until Monday 10/20. Details: https://www.austintexas.gov/trash',
  ),
  legit('school-civic-4', 'Early voting starts Oct 20. Find your polling place and hours: https://www.vote.org/polling-place-locator/'),

  // Retail marketing
  legit('retail-1', 'Old Navy: 50% off everything, today only! Online & in stores. Shop now: https://oldnavy.gap.com/ Reply STOP to opt out'),
  legit(
    'retail-2',
    'Sephora: The Beauty Insider Savings Event is ON. Rouge members get 20% off with code YAYSAVE: https://www.sephora.com/beauty/beauty-insider',
  ),
  legit('retail-3', 'Ulta Beauty: Your 500 points expire 10/31! Use them on your next order: https://www.ulta.com/ultamate-rewards'),
  legit('retail-4', 'Nike: Members get early access to the Air Max drop tomorrow at 10AM. Set a reminder: https://www.nike.com/launch'),
  legit('retail-5', "Domino's: Mix & Match is back! Any 2 or more items for $6.99 each. Order now: https://www.dominos.com/"),
  legit('retail-6', 'Crocs: Members-only sale! 25% off sitewide, today only. Shop now: https://attn.tv/crocs/aB3dE Reply STOP to opt out'),
  legit('retail-7', "Lowe's: Fall savings are here. Up to 40% off select patio furniture. Shop: https://www.lowes.com/l/shop/patio-furniture"),

  // Friends and family sharing links
  legit('friend-link-1', 'omg you need to see this https://youtu.be/9bZkp7q19f0'),
  legit('friend-link-2', "Here's the place for Saturday, parking is in the back https://www.google.com/maps/place/Torchy's+Tacos/@30.2672,-97.7431,17z"),
  legit('friend-link-3', 'this song has been stuck in my head all week https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=a1b2c3d4e5'),
  legit('friend-link-4', 'lmaooo look at this https://www.instagram.com/reel/C9xYzAbCdEf/?igsh=MTc4bXl6'),
  legit('friend-link-5', 'Can you look over my essay before I submit it? https://docs.google.com/document/d/1A2b3C4d5E6f7G8h9I0j/edit?usp=sharing'),
  legit('friend-link-6', 'Sign-up sheet for the potluck, grab a dish! https://forms.gle/Xk3fP9aQm2LrT7w8A'),
  legit('friend-link-7', "the airbnb for the lake trip, split 5 ways it's like $140 each https://www.airbnb.com/rooms/53817264"),
  legit('friend-link-8', 'found the couch I was telling you about https://www.facebook.com/marketplace/item/1234567890/'),
  legit('friend-link-9', "Zoom link for grandma's birthday call tonight at 7: https://us02web.zoom.us/j/84512345678?pwd=bXlQeFZ3TnBk"),
  legit('friend-link-10', 'she posted the video lol https://www.tiktok.com/t/ZTRk3fGxP/'),

  // Popular sites on other endings, and real sites one letter from popular ones
  legit('other-ending-1', "it's way cheaper on the canadian site lol https://www.amazon.ca/dp/B0C1234567"),
  legit('other-ending-2', 'Hey! This is the restaurant near my place in Toronto https://www.google.ca/maps/place/Pai+Northern+Thai'),
  legit('other-ending-3', 'Did you read this?? https://apple.news/AbCdEfGh123'),
  legit('other-ending-4', 'Stars and Stripes article about your old unit: https://www.stripes.com/branches/army/2026-10-10/fort-cavazos-123.html'),
  legit('other-ending-5', 'MetLife: Your dental claim has been processed. View your explanation of benefits at https://www.metlife.com/'),
  legit('other-ending-6', 'new playlist for the road trip https://spotify.link/AbCdEf123'),

  // Personal chat without links
  legit('chat-1', 'Can you Venmo me $18 for the movie tickets? My Cash App is being weird'),
  legit('chat-2', 'Hey it’s me, I got a new phone so this is my new number! Save it 😊'),
  legit('chat-3', 'Did you get the verification code? The Netflix login on the TV keeps asking for it'),
  legit('chat-4', "Thanks for the Starbucks gift card!! You're the best ☕"),
  legit('chat-5', 'Call me when you land, mom is picking you up at terminal B'),
  legit('chat-6', 'Coach Mike: Practice moved to 6pm at Field 3 because of the rain. Bring water!'),
  legit('chat-7', 'Running 10 min late, traffic on 35 is terrible. Order me an iced latte?'),
]

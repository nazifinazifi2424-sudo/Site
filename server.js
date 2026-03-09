const express = require("express")

const app = express()

app.use(express.static("."))

app.get("/", (req,res)=>{
console.log("DEBUG: Home page requested")
res.sendFile(__dirname + "/index.html")
})

const PORT = process.env.PORT || 3000

app.listen(PORT, ()=>{
console.log("DEBUG: Server running on port " + PORT)
})

/* ===============================
DATABASE CONNECTION (NEON)
=============================== */

const {Pool} = require("pg")

let pool

function getConn(){

if(!pool){

console.log("DEBUG: Creating database connection")

pool = new Pool({
connectionString:process.env.DATABASE_URL,
ssl:{rejectUnauthorized:false}
})

}

return pool
}

/* ===============================
AUTO CREATE TABLE
=============================== */

async function createTable(){

try{

console.log("DEBUG: Checking/Creating users table")

const db = getConn()

await db.query(`
CREATE TABLE IF NOT EXISTS users (
id SERIAL PRIMARY KEY,
first_name TEXT,
last_name TEXT,
username TEXT,
phone TEXT,
email TEXT,
password TEXT,
otp TEXT,
verified BOOLEAN DEFAULT FALSE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`)

console.log("DEBUG: Users table ready")

}catch(e){

console.log("DEBUG: Table creation error",e)

}

}

createTable()

/* ===============================
MIDDLEWARE
=============================== */

app.use(express.json())

/* ===============================
OTP GENERATOR
=============================== */

function generateOTP(){

const otp = Math.floor(100000 + Math.random()*900000).toString()

console.log("DEBUG: Generated OTP:",otp)

return otp

}

/* ===============================
EMAIL SENDER
=============================== */

const nodemailer = require("nodemailer")

console.log("DEBUG: Preparing email transporter")

const transporter = nodemailer.createTransport({

service:"gmail",

auth:{
user:process.env.EMAIL_USER,
pass:process.env.EMAIL_PASS
}

})

/* ===============================
REGISTER API
=============================== */

app.post("/register", async (req,res)=>{

console.log("DEBUG: /register API called")

try{

const {firstName,lastName,username,phone,email,password} = req.body

console.log("DEBUG: Received data:",firstName,lastName,username,phone,email)

const otp = generateOTP()

const db = getConn()

console.log("DEBUG: Inserting user into database")

await db.query(

`INSERT INTO users
(first_name,last_name,username,phone,email,password,otp)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,

[firstName,lastName,username,phone,email,password,otp]

)

console.log("DEBUG: User inserted successfully")

console.log("DEBUG: Sending OTP email to:",email)

await transporter.sendMail({

from:process.env.EMAIL_USER,

to:email,

subject:"Your OTP Code",

html:`
<h2>Email Verification</h2>
<p>Your OTP code is:</p>
<h1>${otp}</h1>
<p>This code will be used to verify your account.</p>
`

})

console.log("DEBUG: OTP email sent successfully")

res.json({message:"Account created. OTP sent to your email."})

}catch(err){

console.log("DEBUG: REGISTER ERROR:",err)

res.json({message:"Error creating account"})

}

})

/* ===============================
WAKE NEON DATABASE
=============================== */

setInterval(async ()=>{

try{

console.log("DEBUG: Waking database")

const db = getConn()

await db.query("SELECT 1")

console.log("DEBUG: Database awake")

}catch(e){

console.log("DEBUG: Wake DB error",e)

}

},300000)


/* ===============================
VERIFY OTP API
=============================== */

app.post("/verify-otp", async (req,res)=>{

console.log("DEBUG: /verify-otp API called")

try{

const {email,otp} = req.body

console.log("DEBUG: Verifying email:",email,"OTP:",otp)

const db = getConn()

const result = await db.query(
`SELECT otp FROM users WHERE email=$1`,
[email]
)

console.log("DEBUG: Database query result:",result.rows)

if(result.rows.length === 0){
console.log("DEBUG: User not found")
return res.json({success:false,message:"User not found"})
}

const dbOtp = result.rows[0].otp

console.log("DEBUG: DB OTP:",dbOtp)

if(dbOtp !== otp){
console.log("DEBUG: Invalid OTP entered")
return res.json({success:false,message:"Invalid OTP"})
}

await db.query(
`UPDATE users SET verified=true WHERE email=$1`,
[email]
)

console.log("DEBUG: Account verified successfully")

res.json({success:true,message:"Account verified successfully"})

}catch(e){

console.log("DEBUG: VERIFY ERROR:",e)

res.json({success:false,message:"Verification error"})

}

})
const express = require("express")

const app = express()

app.use(express.static("."))

app.get("/", (req,res)=>{
res.sendFile(__dirname + "/index.html")
})

const PORT = process.env.PORT || 3000

app.listen(PORT, ()=>{
console.log("Server running")
})

/* ===============================
DATABASE CONNECTION (NEON)
=============================== */

const {Pool} = require("pg")

let pool

function getConn(){

if(!pool){

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

console.log("Users table ready")

}catch(e){

console.log("Table error",e)

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

return Math.floor(100000 + Math.random()*900000).toString()

}

/* ===============================
EMAIL SENDER
=============================== */

const nodemailer = require("nodemailer")

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

try{

const {firstName,lastName,username,phone,email,password} = req.body

const otp = generateOTP()

const db = getConn()

await db.query(

`INSERT INTO users
(first_name,last_name,username,phone,email,password,otp)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,

[firstName,lastName,username,phone,email,password,otp]

)

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

res.json({message:"Account created. OTP sent to your email."})

}catch(err){

console.log(err)

res.json({message:"Error creating account"})

}

})

/* ===============================
WAKE NEON DATABASE
=============================== */

setInterval(async ()=>{

try{

const db = getConn()

await db.query("SELECT 1")

}catch(e){}

},300000)


/* ===============================
VERIFY OTP API
=============================== */

app.post("/verify-otp", async (req,res)=>{

try{

const {email,otp} = req.body

const db = getConn()

const result = await db.query(
`SELECT otp FROM users WHERE email=$1`,
[email]
)

if(result.rows.length === 0){
return res.json({success:false,message:"User not found"})
}

const dbOtp = result.rows[0].otp

if(dbOtp !== otp){
return res.json({success:false,message:"Invalid OTP"})
}

await db.query(
`UPDATE users SET verified=true WHERE email=$1`,
[email]
)

res.json({success:true,message:"Account verified successfully"})

}catch(e){

res.json({success:false,message:"Verification error"})

}

})
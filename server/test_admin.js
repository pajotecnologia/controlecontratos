require('dotenv').config();
require('./db').query("SELECT * FROM user_roles WHERE role = 'admin'").then(res => console.log(res.rows)).catch(console.error).finally(() => process.exit(0));

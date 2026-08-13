require('dotenv').config();
require('./db').query("SELECT * FROM agendamentos_envio WHERE status = 'pendente' AND data_agendamento <= NOW()").then(res => console.log(res.rows)).catch(console.error).finally(() => process.exit(0));

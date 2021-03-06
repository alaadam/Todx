const express = require("express");
const Sequelize = require("sequelize");
const sequelize = new Sequelize("mysql://root:1234@localhost/sql_todx");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const config = require("./config");
const rp = require("request-promise");
const elasticsearch = require('elasticsearch');

// const client = new elasticsearch.Client({
//   hosts: "localhost:9200",
// });

// client.ping({requestTimeout: 30000},function (error) {
//     if (error) {
//       console.error("elasticsearch cluster is down!");
//     } else {
//       console.log("Everything is ok");
//     }
//   });

const router = express.Router();

const payload = {
  iss: config.APIKey,
  exp: new Date().getTime() + 5000,
};
const token = jwt.sign(payload, config.APISecret);

const Pusher = require("pusher");
const { response } = require("express");

const pusher = new Pusher({
  appId: config.PUSHER.APP_ID,
  key: config.PUSHER.KEY,
  secret: config.PUSHER.SECRET,
  cluster: config.PUSHER.CLUSTER,
  useTLS: true
});


//===========================================
//--------------user routes------------------
//===========================================
router.get("/users", async (request, response) => {
  let { email, password } = request.query

  let queryString = `SELECT user.* , photo.photo FROM user JOIN photo 
                    WHERE email='${email}' 
                    AND password='${password}'
                    AND photo.id = user.photo_id`

  if (!email && !password)
    queryString = `SELECT user.* , photo.photo FROM user JOIN photo
                    WHERE photo.id = user.photo_id `

  let users = await sequelize.query(queryString);

  response.send(users[0]);
});

router.post("/users", async (request, response) => {
  const user = { ...request.body.user };
  let user_id = Math.floor(Math.random() * 1000000)
  let user_check = await sequelize.query(`SELECT * FROM user WHERE ( first='${user.first}' AND last='${user.last}' ) OR email='${user.email}'`)
  console.log(user_check)
  if (user_check[0][0] != undefined) {
    response.send(false)
  }
  else {
    let image_id = await sequelize.query(`INSERT INTO photo 
                  VALUES( null ,'${user.image}')`)
console.log(image_id[0])
    sequelize.query(
      `INSERT INTO 
      user
      VALUES( ${user_id},'${user.last}','${user.first}',
            '${user.email}','${user.password}', null , '${image_id[0]}')`

    );
    response.send(true);
  }

})

router.get("/allTitles", async (request, response) =>{

  let { userId } = request.query

 let queryString = `select title, todolist.date from todolist
      LEFT JOIN todotask ON todolist.todotask_id = todotask.id
      WHERE user_id	 = '${userId}';`

  let titles = await sequelize.query(queryString);

  console.log(titles[0])

  response.send(titles[0])
})
//===========================================
//--------------profile routes---------------
//===========================================

router.get("/userInfo", async (request, response) => {

  let { userId } = request.query

  let queryString = `SELECT * FROM user WHERE id ='${userId}'`

  let userInfo = await sequelize.query(queryString);

  response.send(userInfo[0]);
});

router.get("/monthlytodotasks", async (request, response) => {

  let { userId, date } = request.query

  let donetasks = await sequelize.query(
    `select count(todotask_id) AS res from todolist
    LEFT JOIN todotask ON todolist.todotask_id = todotask.id
    where todotask.status = 'done'
    AND user_id	 = '${userId}'
    AND todotask.date LIKE '%-${date}-%'
    GROUP BY user_id;`
  )
  let alltasks = await sequelize.query(
    `select count(todotask_id) AS res from todolist
        LEFT JOIN todotask ON todolist.todotask_id = todotask.id
        WHERE user_id	 = '${userId}'
        AND todotask.date LIKE '%-${date}-%'
        GROUP BY user_id;`
  )
  response.send({ donetasks, alltasks })

})

router.get("/dailytodotasks", async (request, response) => {

  let { userId, date } = request.query
  let donetasks = await sequelize.query(
    `select count(todotask_id) AS res from todolist
    LEFT JOIN todotask ON todolist.todotask_id = todotask.id
    where todotask.status = 'done'
    AND user_id	 = '${userId}'
    AND todotask.date LIKE '%-${date}%'
        GROUP BY user_id;`
  )
  let alltasks = await sequelize.query(
    `select count(todotask_id) AS res from todolist
    LEFT JOIN todotask ON todolist.todotask_id = todotask.id
        WHERE user_id	 = '${userId}'
        AND todotask.date LIKE '%-${date}%'
        GROUP BY user_id;`
  )
  response.send({ donetasks, alltasks })

})

router.get("/dailytimedtasks", async (request, response) => {

  let { userId, date, time } = request.query

  let donetasks = await sequelize.query(
    `select count(timedtask_id) AS res from timedlist
    LEFT JOIN timedtask ON timedlist.timedtask_id = timedtask.id
    WhERE user_id	 = ${userId}
    AND timedtask.time LIKE '${time}:%'
    AND timedtask.date LIKE '%-${date}%'
    GROUP BY user_id;`
  )

  response.send(donetasks[0][0])

})

router.get("/monthlytimedtasks", async (request, response) => {

  let { userId, date, time } = request.query

  let donetasks = await sequelize.query(
    `select count(timedtask_id) AS res from timedlist
      LEFT JOIN timedtask ON timedlist.timedtask_id = timedtask.id
        WhERE user_id	 = ${userId}
        AND timedtask.time LIKE '${time}%'
        AND timedtask.date LIKE '%-${date}-%'
        GROUP BY user_id;`
  )

  response.send(donetasks[0][0])

})

router.put("/updatepassword`", async (request, response) => {

  let newPassword = request.body.newPassword
  let id = request.body.id

  let queryString = `UPDATE user 
                      SET password = '${newPassword}'
                      WHERE id = ${id};`

  await sequelize.query(queryString);

  response.send();
});

router.post("/updatephoto", async (request, response) => {

  let data = request.body
  console.log("data------------",data)

  let queryString = `INSERT INTO photo
                     VALUES (null, '${data.body.image}' );`

  let res = await sequelize.query(queryString);
  console.log(res)

  let queryStringUser = `UPDATE user 
                      SET photo_id = '${res[0]}'
                      WHERE id = '${data.body.userId}';`

  await sequelize.query(queryStringUser);
  response.send()
})

router.get("/photo", async (request, response) => {
  let {id} = request.query

  let queryStringUser = `SELECT photo.photo FROM photo JOIN user
                      WHERE photo.id = user.photo_id
                      AND user.id = '${id}';`

  let res = await sequelize.query(queryStringUser)
  console.log(res[0][0].photo)
  response.send(res[0][0].photo)
})



router.put("/updatename`", async (request, response) => {

  let fullName = request.body.FullName
  let id = request.body.id

  let firstName = fullName.split(' ').slice(0, -1).join(' ');
  let lastName = fullName.split(' ').slice(-1).join(' ');

  let queryString = `UPDATE user 
                      SET first = '${firstName}'
                      SET last = '${lastName}'
                      WHERE id = ${id};`

  await sequelize.query(queryString);

  response.send();
});

router.put("/updateInfousers", async (request, response) => {
  console.log(request.body);

  let photoID = 1
  let id = request.body.id
  let newPassword = request.body.newInfo.password
  let first = request.body.newInfo.first
  let last = request.body.newInfo.last
  let queryString = `UPDATE user 
                        SET first = '${first}',
                         last = '${last}',
                         password = '${newPassword}'
                      WHERE id = ${id};`

  await sequelize.query(queryString);



  response.send();


})
//============================================
//--------------todo routes-------------------
//============================================
router.get("/todotasks", async function (req, res) {
  let { today, userId } = req.query
  let sender_name={}
 let user_tasks= await sequelize
    .query(
      `SELECT todotask.* 
                FROM todotask JOIN todolist 
                WHERE todolist.user_id = '${userId}'
                AND todolist.todotask_id = todotask.id
                AND todotask.date = '${today}';`
    )
  
  let sharedTasks= await sequelize
      .query(
        `SELECT todotask.* 
                  FROM todotask JOIN sharedtasks 
                  WHERE sharedtasks.recevier_id = '${userId}'
                  AND sharedtasks.task_id = todotask.id
                  AND todotask.date = '${today}';`
      )

      let sender_id= await sequelize
      .query(
        `SELECT sender_id 
        FROM sharedtasks JOIN todotask 
        WHERE sharedtasks.recevier_id = '${userId}'
        AND sharedtasks.task_id = todotask.id
        AND todotask.date = '${today}';`
      )
   
      if(sender_id[0].length!=0){
        sender_name= await sequelize
       .query(
         `SELECT last,first 
         FROM user
         WHERE id = '${sender_id[0][0].sender_id}';`
       )
       res.send({user_tasks:user_tasks[0],shared_tasks:sharedTasks[0],sender_name:sender_name[0][0]})
       }
       else{
         res.send({user_tasks:user_tasks[0],shared_tasks:sharedTasks[0],sender_name:{}})
       }
});

router.post("/todotasks", async function (req, res) {

  let newTask = req.body;
  let idResult = 0
  await sequelize
    .query(
      `INSERT INTO 
        todotask(title,content,date,priority,status)
        VALUES('${newTask.title}','${newTask.content}','${newTask.date}',
               '${newTask.priority}','${newTask.status}')`
    )
    .then(async function ([result]) {
      idResult = result
      await sequelize
        .query(
          `INSERT INTO 
          todolist(date,user_id,todotask_id)
            VALUES('${newTask.date}',${newTask.userId},'${result}')`
        )
        .then(function ([result]) { });
      });
      
      // client
      //   .index({
      //     index: "Tasks",
      //     body: {
      //       id: idResult,
      //       title: newTask.title,
      //       content: newTask.content,
      //       date: newTask.date,
      //     },
      //   })
      //   .then((response) => {
      //     return res.json({ message: "Indexing successful" });
      //   })
      //   .catch((err) => {
      //     return res.status(500).json({ message: "Error" });
      //   });

  res.send();
});

router.put("/todotasks", async function (req, res) {
  let updateTask = req.body;

  await sequelize
    .query(
      `UPDATE todotask 
        SET title = '${updateTask.title}',
            content = '${updateTask.content}',
            date = '${updateTask.date}',
            priority = ${updateTask.priority},
            status = '${updateTask.status}'
        WHERE id = ${updateTask.id};`
    )
    .then(function ([result]) {
      // console.log("updated");
    });

  res.send();
});

router.delete("/todotasks", async function (req, res) {
  let data = req.body

 await sequelize
    .query(
      ` DELETE FROM todolist 
        WHERE todolist.todotask_id = ${data.taskId}
        AND todolist.user_id = ${data.userId} ; `
    )

 await sequelize.query(
    ` DELETE FROM todotask 
        WHERE id = ${data.taskId}; `
  );
 await sequelize.query(
    ` DELETE FROM sharedtasks 
        WHERE task_id = ${data.taskId}
        AND sender_id=${data.userId} ; `
  );

  res.send("oki");
});

router.put("/donetodotasks", async function (req, res) {

  let taskId = req.body.data.id

  await sequelize
    .query(
      `UPDATE todotask 
        SET status = 'done'
        WHERE id = ${taskId};`
    )
    .then(function ([result]) {
      // console.log("updated");
    });

  res.send();
});


//===========================================
//--------------daily routes-----------------
//===========================================

router.get("/dailytasks", async function (req, res) {
  let { today, userId } = req.query

  await sequelize
    .query(
      `UPDATE dailytask JOIN dailylog JOIN dailylist 
          SET dailytask.status="pending"
        WHERE dailylist.user_id = '${userId}'
        AND dailylog.task_id = dailytask.id
        AND dailylog.date < '${today}'
        AND dailylist.dailytask_id = dailytask.id;`
    )
    .then(function ([result]) {
      sequelize
        .query(
          `UPDATE dailytask JOIN dailylog JOIN dailylist 
            SET dailytask.status="done"
          WHERE dailylist.user_id = '${userId}'
          AND dailylog.task_id = dailytask.id
          AND dailylog.date >= '${today}'
          AND dailylist.dailytask_id = dailytask.id;`
        )
        .then(function ([result]) {
          // console.log("update to done");
          // res.send(result);//insert
        });
      // console.log("done from daily")
      sequelize
        .query(
          `SELECT dailytask.* 
          FROM dailytask JOIN dailylist 
          WHERE dailylist.user_id = '${userId}'
          AND dailytask.date <= '${today}'
          AND dailylist.dailytask_id = dailytask.id;`
        )
        .then(function ([result]) {
          // console.log("reset")
          // console.log(result);
          res.send(result);
        });
      // res.send(result);
    });
});

router.post("/dailytasks", async function (req, res) {
  let newTask = req.body;

  await sequelize
    .query(
      `INSERT INTO 
    dailytask(title,content,status,date)
    VALUES('${newTask.title}','${newTask.content}','${newTask.status}','${newTask.date}')`
    )
    .then(async function ([result]) {
      await sequelize
        .query(
          `INSERT INTO 
        dailylist(user_id,dailytask_id)
        VALUES(${newTask.userId},'${result}')`
        )
        .then(function ([result]) { });
    });

  res.send();
});

router.put("/dailytasks", function (req, res) {
  let updateTask = req.body;
  today = moment().format("YYYY-MM-DD", true)
  console.log(today);
  if (updateTask.date > today) {
    // sequelize
    //   .query(
    //     `UPDATE dailytask 
    //   SET title = '${updateTask.title}',
    //       content = '${updateTask.content}',
    //       status = '${updateTask.status}'
    //       date = '${updateTask.date}'
    //   WHERE id = ${updateTask.id};`
    //   )
    //   .then(function ([result]) {
    //   });
    // sequelize
    //   .query(
    //     `INSERT INTO 
    // dailytask(title,content,status,date)
    // VALUES('${updateTask.title}','${updateTask.content}','${updateTask.status}','${updateTask.date}')`
    //   )
    //   .then(function ([result]) {
    //     sequelize
    //       .query(
    //         `INSERT INTO 
    //     dailylist(user_id,dailytask_id)
    //     VALUES(${updateTask.userId},'${result}')`
    //       )
    //       .then(function ([result]) { });
    //       console.log("2-8");
    //   });
  }
  else {
    sequelize
      .query(
        `UPDATE dailytask 
        SET title = '${updateTask.title}',
            content = '${updateTask.content}',
            status = '${updateTask.status}'
        WHERE id = ${updateTask.id};`
      )
      .then(function ([result]) {
      });
  }
  res.send();
});

router.delete("/dailytasks", function (req, res) {

  let data = req.body;

  sequelize
    .query(
      ` DELETE FROM dailylist 
        WHERE dailylist.dailytask_id = ${data.taskId}
        AND dailylist.user_id ='${data.userId}' ; `
    )
    .then(function ([result]) { });
  sequelize.query(
    ` DELETE FROM dailytask
            WHERE id = ${data.taskId}; `
  );

  res.send("oki");
});

router.put("/donedailytasks", function (req, res) {
  let data = req.body
  sequelize
    .query(
      `UPDATE dailytask 
        SET status = 'done'
        WHERE id = ${data.taskId};`
    )
    .then(function ([result]) {
      console.log("updated");
      sequelize
        .query(
          `INSERT INTO 
           dailylog(task_id,date)
           VALUES( ${data.taskId},'${data.DateOfTheDay}')`
        )
        .then(function ([result]) { });
    });

  res.send();
});

// router.put("/resetdonedailytasks", function (req, res) {

//   sequelize
//     .query(
//       `UPDATE dailytask 
//         SET status = 'pending';`
//     )
//     .then(function ([result]) {
//       console.log("reset done");
//     });

//   res.send();
// });

//===========================================
//--------------timed routes-----------------
//===========================================

router.get("/timedtasks", async function (req, res) {
  let { today, userId } = req.query
  let sender_name={}
    let user_tasks= await sequelize
    .query(
      `SELECT timedtask.* 
              FROM timedtask JOIN timedlist 
              WHERE timedlist.user_id = '${userId}'
              AND timedlist.timedtask_id = timedtask.id
              AND timedtask.date = '${today}';`
    )
  
  let sharedTasks= await sequelize
      .query(
        `SELECT timedtask.* 
                  FROM timedtask JOIN sharedtasks 
                  WHERE sharedtasks.recevier_id = '${userId}'
                  AND sharedtasks.task_id = timedtask.id
                  AND timedtask.date = '${today}';`
      )
  
      let sender_id= await sequelize
      .query(
        `SELECT sender_id 
        FROM sharedtasks JOIN timedtask 
        WHERE sharedtasks.recevier_id = '${userId}'
        AND sharedtasks.task_id = timedtask.id
        AND timedtask.date = '${today}';`
      )
      if(sender_id[0].length!=0){
       sender_name= await sequelize
      .query(
        `SELECT last,first 
        FROM user
        WHERE id = '${sender_id[0][0].sender_id}';`
      )
      res.send({user_tasks:user_tasks[0],shared_tasks:sharedTasks[0],sender_name:sender_name[0][0]})
      }
      else{
        res.send({user_tasks:user_tasks[0],shared_tasks:sharedTasks[0],sender_name:{}})
      }

     
})

router.post("/timedtasks", async function (req, res) {

  let newTask = req.body;

  await sequelize
    .query(
      `INSERT INTO 
        timedtask(title,content,date,time,notification,status)
        VALUES('${newTask.title}','${newTask.content}','${newTask.date}'
              ,'${newTask.time}',${newTask.notification},'${newTask.status}')`
    )
    .then(function ([result]) {
      sequelize
        .query(
          `INSERT INTO 
          timedlist(date,user_id,timedtask_id)
            VALUES('${newTask.date}',${newTask.userId},'${result}')`
        )
        .then(function ([result]) { });
    });

  res.send();
});

router.put("/timedtasks", async function (req, res) {

  let updateTask = req.body;

  await sequelize
    .query(
      `UPDATE timedtask 
        SET title = '${updateTask.title}',
            content = '${updateTask.content}',
            date = '${updateTask.date}',
            time = '${updateTask.time}',
            notification = ${updateTask.notification},
            status = '${updateTask.status}'
        WHERE id = ${updateTask.id};`
    )
    .then(function ([result]) {
      // console.log("updated");
    });

  res.send();
});

router.delete("/timedtasks", async function (req, res) {
  let data = req.body;

 await sequelize
    .query(
      ` DELETE FROM timedlist 
        WHERE timedlist.timedtask_id = ${data.taskId}
        AND timedlist.user_id = ${data.userId} ; `
    )

 await sequelize.query(
    ` DELETE FROM timedtask 
        WHERE id = ${data.taskId}; `
  );
  await sequelize.query(
    ` DELETE FROM sharedtasks 
        WHERE task_id = ${data.taskId}
        AND sender_id=${data.userId} ; `
  );

  res.send("oki");
});

router.put("/donetimedtasks", function (req, res) {


  let taskId = req.body.data.id
  sequelize
    .query(
      `UPDATE timedtask 
        SET status = 'done'
        WHERE id = ${taskId};`
    )
    .then(function ([result]) {
    });

  res.send();
});


//===========================================

router.post("/newmeeting", (req, res) => {
  let options = {
    method: "POST",
    uri: "https://api.zoom.us/v2/users/me/meetings",
    body: {
      topic: req.query.title,
      type: 1,
      settings: {
        host_video: "true",
        participant_video: "true",
      },
    },
    auth: {
      bearer: token,
    },
    headers: {
      "User-Agent": "Zoom-api-Jwt-Request",
      "content-type": "application/json",
    },
    json: true, //Parse the JSON string in the response
  };

  rp(options)
    .then(function (response) {
      let data = {
        start_url: response.start_url,
        join_url: response.join_url
      }
      res.send(data);
    })
    .catch(function (err) {
      // API call failed...
       console.log("API call failed, reason ", err);
    });
});

//===========================================
//--------------share routes------------------
//===========================================
router.post("/shares", async (request, response) => {

  let data = request.body
  let task_id = data.task_id
  let new_task = {}
  let task_type = (data.task_type === "timedlist") ? "timedtask" : "todotask"
  let flag = false

  if (data.task_type === "timedlist" && data.task_id === undefined) {
    flag = true
    task_id = await sequelize.query(`INSERT INTO
        timedtask(title,content,date,time,status)
        VALUES('${data.title}','${data.zoom.start_url}','${data.date}'
              ,'${data.time}','pending')`)
    console.log(data.sender_id)
    sequelize
      .query(
        `INSERT INTO
                timedlist(date,user_id,timedtask_id)
                  VALUES('${data.date}',${data.sender_id},'${task_id[0]}')`
      )
  }

  let taskId = task_id !== data.task_id ? task_id[0] : data.task_id
  if(flag===false){
  let shared = await sequelize.query(
    `INSERT INTO 
     sharedtasks (sender_id,recevier_id,task_id,task_type)
     VALUES('${data.sender_id}','${data.recevier_id}','${taskId}'
          ,'${data.task_type}')`
  );
  }
  let userName = await sequelize.query(
    `SELECT first,last from user
          WHERE id = ${data.sender_id}`
  );

  let task = await sequelize.query(
    `SELECT ${task_type}.* from ${task_type} JOIN ${data.task_type}
     WHERE ${data.task_type}.user_id  = ${data.sender_id}
     AND  ${task_type}.id = ${task_id != data.task_id ? task_id[0] : data.task_id}
    `
  );

  if (flag === true) {
    new_task =
    {
      id: task[0][0].id,
      title: task[0][0].title,
      content: data.zoom.join_url,
      date: task[0][0].date,
      time: task[0][0].time,
      status: task[0][0].status,
      notification: task[0][0].notification
    }
  }

  let channel = `share_task_recevier_id_${data.recevier_id}`

  pusher.trigger(channel, "my-event", {
    message: `You have a new shared task from ${userName[0][0].first} ${userName[0][0].last}`,
    task: flag === true ? new_task : null,
    task_type: task_type

  });
  response.send("shared");
});


module.exports = router;

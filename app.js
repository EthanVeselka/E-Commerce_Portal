const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const dotenv = require("dotenv").config();
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
// sudo npm install --save body-parser
const bodyParser = require("body-parser");

const pool = new Pool({
  user: process.env.PSQL_USER,
  host: process.env.PSQL_HOST,
  database: process.env.PSQL_DATABASE,
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
  ssl: { rejectUnauthorized: false },
});

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/github/callback",
    },
    function (accessToken, refreshToken, profile, done) {
      pool.query(
        `SELECT * FROM users WHERE username = '${profile.username}';`,
        (err, query_res) => {
          if (query_res.rowCount == 1) {
            done(null, profile);
          } else {
            done(null, false);
          }
        }
      );
    }
  )
);

// Create express app
const app = express();
const port = 3000;
app.use(
  session({ secret: "test secret", resave: false, saveUninitialized: false })
);

//Here we are configuring express to use body-parser as middle-ware.
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(passport.initialize());
app.use(passport.session());

//app.use(express.static(__dirname + '/public'));
// allow app to use assets from public folder
app.use(express.static("public"));

// Add process hook to shutdown pool
process.on("SIGINT", function () {
  pool.end();
  // console.log("\nApplication successfully shutdown");
  process.exit(0);
});

app.set("view engine", "ejs");

app.listen(port, () => {
  // console.log(`Example app listening at http://localhost:${port}`);
});

app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});

app.get("/signedin", (req, res) => {
  res.render("index2", { user: req.user });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"] }),
  function (req, res) {}
);

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/login", session: true }),
  function (req, res) {
    res.redirect("/signedin");
  }
);
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

//////////////////////////////////////////// MANAGER PAGE and SUBPAGES /////////////////////////////
// MANAGER PAGE & SUBPAGES ////////////////////////
// menu page
app.get("/manager", isAuthenticated, async (req, res) => {
  menu = [];
  ids = [];

  await pool
    .query("SELECT * FROM menuitems ORDER BY itemid ASC")
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        menu.push(query_res.rows[i]);
        ids.push(query_res.rows[i].itemid);
      }
      res.locals.menu = menu;
    });

  if (Object.keys(req.query).length != 0) {
    var name = req.query.name;
    var price = req.query.price;
    var category = req.query.category;

    await pool.query(`INSERT INTO menuitems (itemid, price, itemname, itemcategory) 
		VALUES (${ids[ids.length - 1] + 1}, ${price}, '${name}', '${category}')`);

    menu = [];

    await pool
      .query("SELECT * FROM menuitems ORDER BY itemid ASC")
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          menu.push(query_res.rows[i]);
        }
        res.locals.menu = menu;
      });
  }

  res.render("manager", res.locals);
});

// delete menu item
app.get("/manager/deletemenu", isAuthenticated, async (req, res) => {
  menu = [];
  var id = req.query.id;

  await pool.query(`DELETE FROM ingredientsforitem WHERE itemid = ${id}`);

  await pool.query(`DELETE FROM orderitems WHERE itemid = ${id}`);

  await pool.query(`DELETE FROM menuitems WHERE itemid = ${id}`);

  await pool
    .query("SELECT * FROM menuitems ORDER BY itemid ASC")
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        menu.push(query_res.rows[i]);
      }
      res.locals.menu = menu;
    });

  res.render("manager", res.locals);
});

// change menu item price
app.get("/manager/changemenu", isAuthenticated, async (req, res) => {
  menu = [];
  var id = req.query.id;
  var price = req.query.price;

  await pool.query(
    `UPDATE menuitems SET price = ${price} WHERE itemid = ${id}`
  );

  await pool
    .query("SELECT * FROM menuitems ORDER BY itemid ASC")
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        menu.push(query_res.rows[i]);
      }
      res.locals.menu = menu;
    });

  res.render("manager", res.locals);
});

// inventory page
app.get("/manager/addinventory", isAuthenticated, async (req, res) => {
  menu = [];
  ingredients = [];

  await pool
    .query("SELECT * FROM menuitems ORDER BY itemid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        menu.push(res_query.rows[i].itemname);
      }
    });

  await pool
    .query("SELECT * FROM maininventory ORDER BY ingredientid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        ingredients.push(res_query.rows[i]);
      }
    });

  res.locals.menu = menu;
  res.locals.ingredients = ingredients;

  res.render("add", res.locals);
});

// delete ingredient
app.get("/manager/deleteingredient", isAuthenticated, async (req, res) => {
  menu = [];
  ingredients = [];
  var id = req.query.id;

  await pool.query(`DELETE FROM ingredientsforitem WHERE ingredientid = ${id}`);

  await pool.query(`DELETE FROM maininventory WHERE ingredientid = ${id}`);

  await pool
    .query("SELECT * FROM menuitems ORDER BY itemid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        menu.push(res_query.rows[i].itemname);
      }
    });

  await pool
    .query("SELECT * FROM maininventory ORDER BY ingredientid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        ingredients.push(res_query.rows[i]);
      }
    });

  res.locals.menu = menu;
  res.locals.ingredients = ingredients;

  res.render("add", res.locals);
});

// decrease ingredient stock amount
app.get("/manager/changeingredient", isAuthenticated, async (req, res) => {
  menu = [];
  ingredients = [];
  var id = req.query.id;
  var change = req.query.change;

  await pool.query(
    `UPDATE maininventory SET ingredientamount = ingredientamount - ${change} WHERE ingredientid = ${id}`
  );

  await pool
    .query("SELECT * FROM menuitems ORDER BY itemid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        menu.push(res_query.rows[i].itemname);
      }
    });

  await pool
    .query("SELECT * FROM maininventory ORDER BY ingredientid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        ingredients.push(res_query.rows[i]);
      }
    });

  res.locals.menu = menu;
  res.locals.ingredients = ingredients;

  res.render("add", res.locals);
});

// add ingredient
app.get("/manager/addingredient", isAuthenticated, async (req, res) => {
  menu = [];
  ingredients = [];
  ids = [];

  await pool
    .query("SELECT * FROM menuitems ORDER BY itemid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        menu.push(res_query.rows[i].itemname);
      }
    });

  await pool
    .query("SELECT * FROM maininventory ORDER BY ingredientid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        ids.push(res_query.rows[i].ingredientid);
      }
    });

  res.locals.menu = menu;

  if (Object.keys(req.query).length != 0) {
    var name = req.query.name;
    var stock = req.query.stock;
    var minStock = req.query.minStock;
    var price = req.query.price;

    await pool.query(`INSERT INTO maininventory (ingredientid, ingredientname, ingredientamount, 
	  ingredientprice, minimumamount) VALUES (${
      ids[ids.length - 1] + 1
    }, '${name}', ${stock}, 
	  ${price}, ${minStock})`);
  }

  await pool
    .query("SELECT * FROM maininventory ORDER BY ingredientid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        ingredients.push(res_query.rows[i]);
      }
    });

  res.locals.ingredients = ingredients;
  res.render("add", res.locals);
});

// add ingredient to menu item
app.get("/manager/ingredienttoitem", isAuthenticated, async (req, res) => {
  menu = [];
  ingredients = [];
  ids = [];

  await pool
    .query("SELECT * FROM menuitems ORDER BY itemid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        menu.push(res_query.rows[i].itemname);
      }
    });

  await pool
    .query("SELECT * FROM maininventory ORDER BY ingredientid ASC")
    .then((res_query) => {
      for (let i = 0; i < res_query.rowCount; i++) {
        ingredients.push(res_query.rows[i].ingredientname);
        ids.push(res_query.rows[i].ingredientid);
      }
    });

  res.locals.menu = menu;
  res.locals.ingredients = ingredients;

  if (Object.keys(req.query).length != 0) {
    var menuItem = req.query.item;
    var ingredient = req.query.ingredient;
    var quantity = req.query.quantity;

    var itemID;
    var ingredientID;

    await pool
      .query(`SELECT * FROM menuitems WHERE itemname = '${menuItem}'`)
      .then((res_query) => {
        itemID = res_query.rows[0].itemid;
      });

    await pool
      .query(
        `SELECT * FROM maininventory WHERE ingredientname = '${ingredient}'`
      )
      .then((res_query) => {
        ingredientID = res_query.rows[0].ingredientid;
      });

    await pool.query(`INSERT INTO ingredientsforitem (itemid, ingredientid, quantity) 
	VALUES (${itemID}, ${ingredientID}, ${quantity})`);
  }

  res.render("add", res.locals);
});

let restockList = [];
let amountRestock = [];

// for restock report
app.get("/manager/restock", isAuthenticated, async (req, res) => {
  restockList = [];
  amountRestock = [];
  priceRestock = [];

  await pool
    .query("SELECT * FROM maininventory ORDER BY ingredientid ASC")
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        var currentStock = query_res.rows[i].ingredientamount;
        var minStock = query_res.rows[i].minimumamount;
        if (minStock > currentStock) {
          restockList.push(query_res.rows[i]);
          amountRestock.push(minStock - currentStock);
          var price =
            query_res.rows[i].ingredientprice * (minStock - currentStock);
          priceRestock.push(Math.round(price * 100) / 100);
        }
      }
    });

  res.locals.restockList = restockList;
  res.locals.amountRestock = amountRestock;
  res.locals.priceRestock = priceRestock;
  res.locals.restocked = false;

  res.render("restock", res.locals);
});

// for restocking all items based restock report
app.get("/manager/stock", async (req, res) => {
  for (var i in restockList) {
    await pool.query(`UPDATE maininventory SET ingredientamount = ingredientamount + ${amountRestock[i]} 
	WHERE ingredientname = '${restockList[i].ingredientname}'`);
    // console.log(`Restocked ${restockList[i].ingredientname}`);
  }

  restockList = [];
  amountRestock = [];

  res.locals.restockList = restockList;
  res.locals.restocked = true;

  res.render("restock", res.locals);
});

// for sales report
app.get("/manager/sales", isAuthenticated, async (req, res) => {
  res.locals.display = false;

  if (Object.keys(req.query).length != 0) {
    res.locals.display = true;
    var start = req.query.startdate;
    var end = req.query.enddate;

    start = new Date(start).toISOString().slice(0, 10);
    end = new Date(end).toISOString().slice(0, 10);

    const pairsMap = new Map();
    const itemsMap = new Map();

    let itemIDs = [];
    let itemNames = [];
    let itemCategories = [];
    let itemPrice = [];
    let numSold = [];
    let itemTotal = [];

    await pool
      .query("SELECT * FROM menuitems ORDER BY itemid ASC")
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          itemIDs.push(query_res.rows[i].itemid);
          itemNames.push(query_res.rows[i].itemname);
          itemCategories.push(query_res.rows[i].itemcategory);
          itemPrice.push(query_res.rows[i].price);
          numSold.push(0);
          itemTotal.push(0);
          itemsMap.set(i + 1, query_res.rows[i].itemname);
        }
      });

    orderIDs = [];

    await pool
      .query(
        `SELECT * FROM PastOrders WHERE Date >= '${start}' AND DATE <= '${end}' ORDER BY OrderID ASC`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          orderIDs.push(query_res.rows[i].orderid);
        }
      });

    await pool
      .query(
        `SELECT * FROM OrderItems WHERE OrderId BETWEEN ${orderIDs[0]} AND ${
          orderIDs[orderIDs.length - 1]
        } ORDER BY ItemID ASC`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          numSold[query_res.rows[i].itemid - 1] += query_res.rows[i].quantity;
        }
      });

    for (let i = 0; i < itemTotal.length; i++) {
      var total = numSold[i] * itemPrice[i];
      itemTotal[i] = Math.round(total * 100) / 100;
    }

    var sales = [];
    for (var i = 0; i < itemIDs.length; i++) {
      sales.push({
        ids: itemIDs[i],
        name: itemNames[i],
        category: itemCategories[i],
        price: itemPrice[i],
        num: numSold[i],
        total: itemTotal[i],
      });
    }

    sales.sort(function (a, b) {
      return a.num > b.num ? -1 : a.num == b.num ? 0 : 1;
    });

    itemIDs = [];
    itemNames = [];
    itemCategories = [];
    itemPrice = [];
    numSold = [];
    itemTotal = [];

    for (var i = 0; i < sales.length; i++) {
      itemIDs[i] = sales[i].ids;
      itemNames[i] = sales[i].name;
      itemCategories[i] = sales[i].category;
      itemPrice[i] = sales[i].price;
      numSold[i] = sales[i].num;
      itemTotal[i] = sales[i].total;
    }

    res.locals.itemIDs = itemIDs;
    res.locals.itemNames = itemNames;
    res.locals.itemCategories = itemCategories;
    res.locals.itemPrice = itemPrice;
    res.locals.numSold = numSold;
    res.locals.itemTotal = itemTotal;

    for (const orderID of orderIDs) {
      itemIDs = [];

      await pool
        .query(
          `SELECT * FROM OrderItems WHERE OrderId = ${orderID} ORDER BY ItemID ASC`
        )
        .then((query_res) => {
          for (let i = 0; i < query_res.rowCount; i++) {
            for (let j = 0; j < query_res.rows[i].quantity; j++) {
              itemIDs.push(query_res.rows[i].itemid);
            }
          }
        });

      if (itemIDs.length < 2) {
        continue;
      } else {
        for (let i = 0; i < itemIDs.length; i++) {
          let item1 = itemsMap.get(itemIDs[i]);
          for (let j = i; j < itemIDs.length; j++) {
            let item2 = itemsMap.get(itemIDs[j]);
            let key = `${item1}, ${item2}`;
            if (pairsMap.has(key)) {
              pairsMap.set(key, pairsMap.get(key) + 1);
            } else {
              pairsMap.set(key, 1);
            }
          }
        }
      }
    }

    const sortedPairs = new Map(
      [...pairsMap.entries()].sort((a, b) => b[1] - a[1])
    );

    res.locals.sortedPairs = sortedPairs;
  }

  res.render("sales", res.locals);
});

// for excess report
app.get("/manager/excess", isAuthenticated, async (req, res) => {
  res.locals.display = false;

  if (Object.keys(req.query).length != 0) {
    res.locals.display = true;
    var start = req.query.startdate;

    start = new Date(start).toISOString().slice(0, 10);

    ingredientIDs = [];
    ingredientNames = [];
    stockStart = [];
    stockEnd = [];
    percentageUsed = [];

    await pool
      .query("SELECT * FROM maininventory ORDER BY ingredientid ASC")
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          ingredientIDs.push(query_res.rows[i].ingredientid);
          ingredientNames.push(query_res.rows[i].ingredientname);
          stockStart.push(query_res.rows[i].ingredientamount);
          stockEnd.push(query_res.rows[i].ingredientamount);
        }
      });

    orderIDs = [];

    await pool
      .query(
        `SELECT * FROM PastOrders WHERE Date >= '${start}' ORDER BY OrderID ASC`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          orderIDs.push(query_res.rows[i].orderid);
        }
      });

    itemIDs = [];

    await pool
      .query(
        `SELECT * FROM OrderItems WHERE OrderId BETWEEN ${orderIDs[0]} AND ${
          orderIDs[orderIDs.length - 1]
        } ORDER BY ItemID ASC`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          for (let j = 0; j < query_res.rows[i].quantity; j++) {
            itemIDs.push(query_res.rows[i].itemid);
          }
        }
      });

    for (let i = 0; i < itemIDs.length; i++) {
      await pool
        .query(`SELECT * FROM IngredientsForItem WHERE ItemId = ${itemIDs[i]}`)
        .then((query_res) => {
          for (let j = 0; j < query_res.rowCount; j++) {
            stockStart[query_res.rows[j].ingredientid] +=
              query_res.rows[j].quantity;
          }
        });
    }

    for (let i = 0; i < stockStart.length; i++) {
      var percentage = (stockStart[i] - stockEnd[i]) / stockStart[i];
      percentageUsed.push(Math.round(percentage * 10000) / 100);
    }

    res.locals.ingredientIDs = ingredientIDs;
    res.locals.ingredientNames = ingredientNames;
    res.locals.stockStart = stockStart;
    res.locals.stockEnd = stockEnd;
    res.locals.percentageUsed = percentageUsed;
  }

  res.render("excess", res.locals);
});

//////////////////////// SERVER PAGE & SUBPAGES ////////////////////////
// create a class that will represent a menu item

class customerMenuItem {
  constructor(
    itemName,
    price,
    removeIngredients,
    enhancers,
    enhancerPrices,
    proteins,
    proteinPrices,
    fruits_vegetables,
    fruit_vegetablePrices,
    extras,
    extraPrices
  ) {
    this.itemName = itemName;
    this.price = price;
    this.removeIngredients = removeIngredients;
    this.enhancers = enhancers;
    this.enhancerPrices = enhancerPrices;
    this.proteins = proteins;
    this.proteinPrices = proteinPrices;
    this.fruits_vegetables = fruits_vegetables;
    this.fruit_vegetablePrices = fruit_vegetablePrices;
    this.extras = extras;
    this.extraPrices = extraPrices;
  }

  // get the total price of the item
  getTotalPrice() {
    let totalPrice = this.price;
    if (this.enhancers != undefined) {
      for (let i = 0; i < this.enhancers.length; i++) {
        var enhancerPrice = this.enhancerPrices[i];
        enhancerPrice = Number(enhancerPrice);
        totalPrice += enhancerPrice;
      }
    }
    if (this.proteins != undefined) {
      for (let i = 0; i < this.proteins.length; i++) {
        var proteinPrice = this.proteinPrices[i];
        proteinPrice = Number(proteinPrice);
        totalPrice += proteinPrice;
      }
    }
    if (this.fruits_vegetables != undefined) {
      for (let i = 0; i < this.fruits_vegetables.length; i++) {
        var fruit_vegetablePrice = this.fruit_vegetablePrices[i];
        fruit_vegetablePrice = Number(fruit_vegetablePrice);
        totalPrice += fruit_vegetablePrice;
      }
    }
    if (this.extras != undefined) {
      for (let i = 0; i < this.extras.length; i++) {
        var extraPrice = this.extraPrices[i];
        extraPrice = Number(extraPrice);
        totalPrice += extraPrice;
      }
    }

    return totalPrice.toFixed(2);
  }

  // print the item
  printItem() {
    console.log("Item Name: " + this.itemName);
    console.log("Item Price: " + this.price);
    console.log("Remove Ingredients: " + this.removeIngredients);
    console.log("Enhancers: " + this.enhancers);
    console.log("Enhancer Prices: " + this.enhancerPrices);
    console.log("Proteins: " + this.proteins);
    console.log("Protein Prices: " + this.proteinPrices);
    console.log("Fruits/Vegetables: " + this.fruits_vegetables);
    console.log("Fruit/Vegetable Prices: " + this.fruit_vegetablePrices);
    console.log("Extras: " + this.extras);
    console.log("Extra Prices: " + this.extraPrices);
    console.log("Total Price: " + this.getTotalPrice());
  }
}

class customerOrder {
  constructor() {
    this.items = []; // array of menu items
    this.total = 0;
    this.customerName = "";
    this.customerPhone = "";
    this.startTime = new Date();
    this.finishTime = new Date();
    this.orderDate = new Date();
  }

  addItem(item) {
    this.items.push(item);
  }

  removeItem(index) {
    this.items.splice(index, 1);
  }

  getTotal() {
    let totalPrice = 0;
    for (let i = 0; i < this.items.length; i++) {
      totalPrice += Number(this.items[i].getTotalPrice());
    }
    return totalPrice.toFixed(2);
  }

  updateTotal() {
    this.total = this.getTotal();
  }

  printOrder() {
    console.log("Customer Name: " + this.customerName);
    console.log("Customer Email: " + this.customerEmail);
    console.log("Start Time: " + this.startTime);
    console.log("Finish Time: " + this.finishTime);
    console.log("Order Date: " + this.orderDate);
    console.log("Items: ");
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].printItem();
    }
    console.log("Total Price: " + this.getTotal());
  }

  setFinishTime(time) {
    this.finishTime = time;
  }
}

// current order
let serverOrder = new customerOrder();
// list of submitted orders
let submittedOrders = [];

// server page -> display each category of smoothie as a button
app.get("/server", isAuthenticated, async (req, res) => {
  res.locals.order = serverOrder;
  res.locals.submittedOrders = submittedOrders;
  res.render("server", res.locals);
});

app.post("/server", isAuthenticated, async (req, res) => {
  // removes an order from the queue and updates database accordingly
  if (req.body.completeOrder) {
    var completeOrderIndex = req.body.completeOrderIndex;
    let order = submittedOrders[completeOrderIndex];
    submittedOrders.splice(completeOrderIndex, 1);
    let dateTime = new Date();
    let finishTime = dateTime.toISOString().substring(11, 19);
    order.setFinishTime(finishTime);
    let orderID = 0;
    await pool
      .query("SELECT * FROM PastOrders ORDER BY OrderID DESC LIMIT 1")
      .then((query_res) => {
        orderID = query_res.rows[0].orderid;
      });
    //add the new order to the database
    await pool
      .query(
        `INSERT INTO PastOrders (orderid, customername, totalprice, timein, timeout, date) VALUES (${
          orderID + 1
        }, '${order.customerName}', ${order.total}, '${order.startTime}', '${
          order.finishTime
        }', '${order.orderDate}')`
      )
      .then((query_res) => {});
    // update maininventory table and orderitems table
    for (orderItem of order.items) {
      let itemid = 0;
      await pool
        .query(
          `SELECT itemid FROM menuitems WHERE itemname LIKE '%${orderItem.itemName}'`
        )
        .then((query_res) => {
          itemid = query_res.rows[0].itemid;
        });
      // get ingredients list for item
      await pool
        .query(`SELECT * FROM ingredientsforitem WHERE itemid=${itemid}`)
        .then((query_res) => {
          for (var i = 0; i < query_res.rowCount; i++) {
            let ingredientid = query_res.rows[i].ingredientid;
            let quantity = query_res.rows[i].quantity;
            // get ingredient name and check if it needs to be excluded
            pool
              .query(
                `SELECT ingredientname FROM maininventory WHERE ingredientid=${ingredientid}`
              )
              .then((res) => {
                let ingredientname = res.rows[0].ingredientname;
                // if we aren't excluding this ingredient, update maininventory
                if (!orderItem.removeIngredients.includes(ingredientname)) {
                  pool.query(
                    `UPDATE maininventory SET ingredientamount = ingredientamount - ${quantity} WHERE ingredientid = '${ingredientid}'`
                  );
                }
              });
          }
        });
      // update maininventory for enhancers
      for (enhancer of orderItem.enhancers) {
        await pool.query(
          `UPDATE maininventory SET ingredientamount = ingredientamount - 1 WHERE ingredientname LIKE '%${enhancer}'`
        );
      }
      // update maininventory for proteins
      for (protein of orderItem.proteins) {
        await pool.query(
          `UPDATE maininventory SET ingredientamount = ingredientamount - 1 WHERE ingredientname LIKE '%${protein}'`
        );
      }
      // update maininventory for fruits and vegetables
      for (fruit_vegetable of orderItem.fruits_vegetables) {
        await pool.query(
          `UPDATE maininventory SET ingredientamount = ingredientamount - 1 WHERE ingredientname LIKE '%${fruit_vegetable}'`
        );
      }
      // update maininventory for extras
      for (extra of orderItem.extras) {
        await pool.query(
          `UPDATE maininventory SET ingredientamount = ingredientamount - 1 WHERE ingredientname LIKE '%${extra}'`
        );
      }
      // check if orderitems already has an entry for the item, otherwise create one
      await pool
        .query(
          `SELECT * FROM orderitems WHERE itemid=${itemid} AND orderid=${
            orderID + 1
          }`
        )
        .then((re) => {
          if (re.rowCount > 0) {
            pool.query(
              `UPDATE orderitems SET quantity = quantity + 1 WHERE itemid=${itemid} AND orderid=${
                orderID + 1
              }`
            );
          } else {
            pool.query(
              `INSERT INTO orderitems (orderid,itemid,quantity) VALUES (${
                orderID + 1
              },${itemid},1)`
            );
          }
        });
    }
    // update salesdata table
    let timeIn = order.startTime;
    let hourString = timeIn.split(":")[0];
    let hour = parseInt(hourString);
    let date = order.orderDate;
    date = date.replace(/-/g, "");
    let hourID = date + hourString;

    // if the hourID exists, update the sales table
    await pool
      .query(`SELECT * FROM salesdata WHERE hourid = '${hourID}'`)
      .then((query_res) => {
        if (query_res.rows.length > 0) {
          pool.query(
            `UPDATE salesdata SET salestotal = salestotal + ${order.total} WHERE hourid = '${hourID}'`
          );
          // increment the number of orders
          pool.query(
            `UPDATE salesdata SET ordercount = ordercount + 1 WHERE hourid = '${hourID}'`
          );
        }
        // if the hourID does not exist, create a new row in the sales table
        else {
          pool.query(
            `INSERT INTO salesdata (hourid, date, hour, salestotal, ordercount) VALUES ('${hourID}', '${date}', ${hour}, ${order.total}, 1)`
          );
        }
      });
    res.redirect("/server");
  }

  // remove an order from the queue without completing it (cancel an order)
  else if (req.body.cancelOrder) {
    var cancelOrderIndex = req.body.cancelOrderIndex;
    submittedOrders.splice(cancelOrderIndex, 1);
    res.redirect("/server");
  }

  // remove an item from the current order
  else if (req.body.cancelItem) {
    var cancelItemNumber = req.body.cancelItemNumber;
    serverOrder.items.splice(cancelItemNumber, 1);
    res.redirect("/server");
  }
});

// POST REQUESTS that are coming to the server will land here
// - post requests so far: add item to current order, submit order from the queue, take an order from the queue and cancel it
app.post("/server", isAuthenticated, async (req, res) => {
  // if post contains an item, add it to the order (check if itemname was sent)
  if (req.body.itemname) {
    // this isnt happening here anymore because I added customization
  }

  // if an order is completed, remove it from the queue and update the database
  else if (req.body.orderNumber) {
    let orderNumber = req.body.orderNumber;
    let orderIndex = parseInt(orderNumber.split("#")[1]) - 1;
    let dateTime = new Date();
    let finishTime = dateTime.toISOString().substring(11, 19);
    let order = submittedOrders[orderIndex];
    order.setFinishTime(finishTime);

    // remove from the array
    submittedOrders.splice(orderIndex, 1);

    // update the database
    // get the order id of the last order
    let orderID = 0;
    await pool
      .query("SELECT * FROM PastOrders ORDER BY OrderID DESC LIMIT 1")
      .then((query_res) => {
        orderID = query_res.rows[0].orderid;
      });

    // add the new order to the database
    await pool
      .query(
        `INSERT INTO PastOrders (orderid, customername, totalprice, timein, timeout, date) VALUES (${
          orderID + 1
        }, '${order.customerName}', ${order.total}, '${order.startTime}', '${
          order.finishTime
        }', '${order.orderDate}')`
      )
      .then((query_res) => {});

    // update the main inventory table based on the items in the order
    for (let i = 0; i < order.items.length; i++) {
      let item = order.items[i];
      for (let j = 0; j < item.regularIngredientsData.length; j++) {
        let ingredient = item.regularIngredientsData[j].ingredientName;
        let quantity = item.regularIngredientsData[j].quantity;
        let ingredientID = 0;
        await pool
          .query(
            `SELECT ingredientid FROM maininventory WHERE ingredientname LIKE '%${ingredient}%'`
          )
          .then((query_res) => {
            ingredientID = query_res.rows[0].ingredientid;
          });
        await pool.query(
          `UPDATE maininventory SET ingredientamount = ingredientamount - ${quantity} WHERE ingredientid = '${ingredientID}'`
        );
      }
      if (item.additionalIngredientsData.length > 0) {
        for (let j = 0; j < item.additionalIngredientsData.length; j++) {
          let ingredient = item.additionalIngredientsData[j].ingredientName;
          let quantity = item.additionalIngredientsData[j].quantity;
          let ingredientID = 0;
          if (quantity > 0) {
            await pool
              .query(
                `SELECT ingredientid FROM maininventory WHERE ingredientname LIKE '%${ingredient}%'`
              )
              .then((query_res) => {
                ingredientID = query_res.rows[0].ingredientid;
              });

            await pool.query(
              `UPDATE maininventory SET ingredientamount = ingredientamount - ${quantity} WHERE ingredientid = '${ingredientID}'`
            );
          }
        }
      }
    }
    // update the sales table based on order
    let timeIn = order.startTime;
    let hourString = timeIn.split(":")[0];
    let hour = parseInt(hourString);
    let date = order.orderDate;
    date = date.replace(/-/g, "");
    let hourID = date + hourString;

    // if the hourID exists, update the sales table
    await pool
      .query(`SELECT * FROM salesdata WHERE hourid = '${hourID}'`)
      .then((query_res) => {
        if (query_res.rows.length > 0) {
          pool.query(
            `UPDATE salesdata SET salestotal = salestotal + ${order.total} WHERE hourid = '${hourID}'`
          );
          // increment the number of orders
          pool.query(
            `UPDATE salesdata SET ordercount = ordercount + 1 WHERE hourid = '${hourID}'`
          );
        }
        // if the hourID does not exist, create a new row in the sales table
        else {
          pool.query(
            `INSERT INTO salesdata (hourid, date, hour, salestotal, ordercount) VALUES ('${hourID}', '${date}', ${hour}, ${order.total}, 1)`
          );
        }
      });

    res.redirect("/server");
  }
  // if an order is cancelled, remove it from the queue
  else if (req.body.cancelOrderNumber) {
    let orderNumber = req.body.cancelOrderNumber;
    let orderIndex = parseInt(orderNumber.split("#")[1]) - 1;
    submittedOrders.splice(orderIndex, 1);
    res.redirect("/server");
  }
  // if an item in the current order is removed, remove it from the order
  else if (req.body.deleteItemNumber != undefined) {
    let itemNumber = req.body.deleteItemNumber;
    let itemIndex = parseInt(itemNumber);
    order.removeItem(order.items[itemIndex]);
    res.redirect("/server");
  }
});

// handle GET request for server checkout page
app.get("/serverCheckoutForm", async (req, res) => {
  res.locals.order = serverOrder;
  res.locals.submittedOrders = submittedOrders;
  if (req.query.firstName) {
    let firstName = req.query.firstName;
    let lastName = req.query.lastName;
    let phone = req.query.phone;
    let email = req.query.email;

    serverOrder.customerName = firstName + " " + lastName;
    serverOrder.customerPhone = phone;
    serverOrder.customerEmail = email;
    let dateTime = new Date();
    serverOrder.startTime = dateTime.toISOString().substring(11, 19);
    serverOrder.orderDate = dateTime.toISOString().substring(0, 10);

    serverOrder.updateTotal();
    submittedOrders.push(serverOrder);
    serverOrder = new customerOrder();

    res.redirect("/server");
  } else {
    res.render("serverCheckoutForm", res.locals);
  }
});

// display fitness smoothies
app.get("/fitness", isAuthenticated, async (req, res) => {
  fitness = [];
  await pool
    .query(
      "SELECT * FROM menuitems WHERE itemcategory = 'Fitness' ORDER BY itemid ASC"
    )
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        fitness.push(query_res.rows[i]);
      }
      res.locals.fitness = fitness;
      res.locals.order = serverOrder;
      res.locals.submittedOrders = submittedOrders;
      res.render("fitness", res.locals);
    });
});

// display BeWell smoothies
app.get("/bewell", isAuthenticated, async (req, res) => {
  bewell = [];
  await pool
    .query(
      "SELECT * FROM menuitems WHERE itemcategory = 'Be Well' ORDER BY itemid ASC"
    )
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        bewell.push(query_res.rows[i]);
      }
      res.locals.bewell = bewell;
      res.locals.order = serverOrder;
      res.locals.submittedOrders = submittedOrders;
      res.render("bewell", res.locals);
    });
});

// display Treat smoothies
app.get("/treat", isAuthenticated, async (req, res) => {
  treat = [];
  await pool
    .query(
      "SELECT * FROM menuitems WHERE itemcategory = 'Treat' ORDER BY itemid ASC"
    )
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        treat.push(query_res.rows[i]);
      }
      res.locals.treat = treat;
      res.locals.order = serverOrder;
      res.locals.submittedOrders = submittedOrders;
      res.render("treat", res.locals);
    });
});

// display weightloss smoothies
app.get("/weightloss", isAuthenticated, async (req, res) => {
  weightloss = [];
  await pool
    .query(
      "SELECT * FROM menuitems WHERE itemcategory = 'Weight Loss' ORDER BY itemid ASC"
    )
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        weightloss.push(query_res.rows[i]);
      }
      res.locals.weightloss = weightloss;
      res.locals.order = serverOrder;
      res.locals.submittedOrders = submittedOrders;
      res.render("weightloss", res.locals);
    });
});

// CUSTOMIZATION PAGE FOR SMOOTHIES (GET)
// if a smoothie is clicked, load the smoothie page with the smoothie information as well
// as other ingredients that can be added to the smoothie
app.get("/smoothie", isAuthenticated, async (req, res) => {
  if (req.query.itemname) {
    let itemName = req.query.itemname;
    for (let i = 0; i < itemName.length; i++) {
      if (itemName[i] == "*") {
        itemName = itemName.substring(0, i) + " " + itemName.substring(i + 1);
      }
    }

    let itemID = 0;
    let price = 0;
    await pool
      .query(`SELECT * FROM menuitems WHERE itemname = '${itemName}'`)
      .then((query_res) => {
        itemID = query_res.rows[0].itemid;
        price = query_res.rows[0].price;
      });
    let ingredients = [];
    let quanities = [];
    await pool
      .query(
        `SELECT ingredientid, quantity FROM ingredientsforitem WHERE itemid = ${itemID}`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          ingredients.push(query_res.rows[i]);
        }
      });
    let ingredientNames = [];
    for (let i = 0; i < ingredients.length; i++) {
      let ingredientID = ingredients[i].ingredientid;
      quanities.push(ingredients[i].quantity);
      await pool
        .query(
          `SELECT * FROM maininventory WHERE ingredientid = ${ingredientID}`
        )
        .then((query_res) => {
          ingredientNames.push(query_res.rows[0].ingredientname);
        });
    }
    // get any ingredients that are have 'enhancer' in their ingredient name from main inventory and add to enhancers list
    let enhancers = [];
    let enhancerPrices = [];
    await pool
      .query(`SELECT * FROM maininventory WHERE ingredienttype = 'Enhancer'`)
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          enhancers.push(query_res.rows[i].ingredientname);
          enhancerPrices.push(query_res.rows[i].ingredientprice);
        }
      });
    // get any ingredients that are have 'Protein' as their ingredienttype from main inventory and add to protein list
    let protein = [];
    let proteinPrices = [];

    await pool
      .query(`SELECT * FROM maininventory WHERE ingredienttype = 'Protein'`)
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          protein.push(query_res.rows[i].ingredientname);
          proteinPrices.push(query_res.rows[i].ingredientprice);
        }
      });

    // get any ingredients that are have 'Fruit or Vegetable' as their ingredienttype from main inventory and add to fruit_vegatable list
    let fruit_vegetable = [];
    let fruit_vegetablePrices = [];
    await pool
      .query(
        `SELECT * FROM maininventory WHERE ingredienttype = 'Fruit or Vegetable'`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          fruit_vegetable.push(query_res.rows[i].ingredientname);
          fruit_vegetablePrices.push(query_res.rows[i].ingredientprice);
        }
      });
    // get any ingredients that have extras as their ingredienttype from main inventory and add to extras list
    let extras = [];
    let extrasPrices = [];
    await pool
      .query(`SELECT * FROM maininventory WHERE ingredienttype = 'Extra'`)
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          extras.push(query_res.rows[i].ingredientname);
          extrasPrices.push(query_res.rows[i].ingredientprice);
        }
      });

    res.locals.ingredients = ingredients;
    res.locals.ingredientNames = ingredientNames;
    res.locals.itemname = itemName;
    res.locals.price = price;
    res.locals.quanities = quanities;
    res.locals.enhancers = enhancers;
    res.locals.enhancerPrices = enhancerPrices;
    res.locals.protein = protein;
    res.locals.proteinPrices = proteinPrices;
    res.locals.fruit_vegetable = fruit_vegetable;
    res.locals.fruit_vegetablePrices = fruit_vegetablePrices;
    res.locals.extras = extras;
    res.locals.extrasPrices = extrasPrices;
    res.locals.submittedOrders = submittedOrders;
    res.locals.orderCustomer = serverOrder;

    try {
      res.render("smoothie", res.locals);
    } catch (err) {
      console.log(err);
    }
  } else {
    // redirect to server page
    res.redirect("/customer");
  }
});

// CUSTOMIZATION PAGE FOR SMOOTHIES (POST)
// when the user sends the form, go thru and complete the item for the order
app.post("/smoothie", async (req, res) => {
  if (req.body.addItem) {
    let item = new customerMenuItem(
      req.body.smoothieName,
      Number(req.body.smoothiePrice),
      req.body.removeIngredients,
      req.body.enhancers,
      req.body.enhancersPrices,
      req.body.proteins,
      req.body.proteinsPrices,
      req.body.fruits,
      req.body.fruitsPrices,
      req.body.extras,
      req.body.extrasPrices
    );

    // add item to order
    serverOrder.addItem(item);
  }
});

// middleware that checks if a user is logged in before allowing access
// to protected pages (manager, server)
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/login");
  }
}

////////    STARTING TO BUILD CUSTOMER PAGE    ////////

let custOrder = new customerOrder();

// CUSTOMER PAGE (GET)
app.get("/customer", async (req, res) => {
  // weight loss
  weightloss = [];
  weightlossIngredients = [];
  await pool
    .query(
      "SELECT * FROM menuitems WHERE itemcategory = 'Weight Loss' ORDER BY itemid ASC"
    )
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        weightloss.push(query_res.rows[i]);
      }
    });
  for (let i = 0; i < weightloss.length; i++) {
    let itemID = weightloss[i].itemid;
    let ingredients = [];
    await pool
      .query(
        `SELECT ingredientid, quantity FROM ingredientsforitem WHERE itemid = ${itemID}`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          ingredients.push(query_res.rows[i].ingredientid);
        }
      });
    let ingredientNames = [];
    for (let i = 0; i < ingredients.length; i++) {
      let ingredientID = ingredients[i];
      await pool
        .query(
          `SELECT * FROM maininventory WHERE ingredientid = ${ingredientID}`
        )
        .then((query_res) => {
          ingredientNames.push(query_res.rows[0].ingredientname);
        });
    }
    weightlossIngredients.push(ingredientNames);
  }
  // fitness
  fitness = [];
  fitnessIngredients = [];
  await pool
    .query(
      "SELECT * FROM menuitems WHERE itemcategory = 'Fitness' ORDER BY itemid ASC"
    )
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        fitness.push(query_res.rows[i]);
      }
    });
  for (let i = 0; i < fitness.length; i++) {
    let itemID = fitness[i].itemid;
    let ingredients = [];
    await pool
      .query(
        `SELECT ingredientid, quantity FROM ingredientsforitem WHERE itemid = ${itemID}`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          ingredients.push(query_res.rows[i].ingredientid);
        }
      });
    let ingredientNames = [];
    for (let i = 0; i < ingredients.length; i++) {
      let ingredientID = ingredients[i];
      await pool
        .query(
          `SELECT * FROM maininventory WHERE ingredientid = ${ingredientID}`
        )
        .then((query_res) => {
          ingredientNames.push(query_res.rows[0].ingredientname);
        });
    }
    fitnessIngredients.push(ingredientNames);
  }
  // Be Well
  bewell = [];
  bewellIngredients = [];
  await pool
    .query(
      "SELECT * FROM menuitems WHERE itemcategory = 'Be Well' ORDER BY itemid ASC"
    )
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        bewell.push(query_res.rows[i]);
      }
    });
  for (let i = 0; i < bewell.length; i++) {
    let itemID = bewell[i].itemid;
    let ingredients = [];
    await pool
      .query(
        `SELECT ingredientid, quantity FROM ingredientsforitem WHERE itemid = ${itemID}`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          ingredients.push(query_res.rows[i].ingredientid);
        }
      });
    let ingredientNames = [];
    for (let i = 0; i < ingredients.length; i++) {
      let ingredientID = ingredients[i];
      await pool
        .query(
          `SELECT * FROM maininventory WHERE ingredientid = ${ingredientID}`
        )
        .then((query_res) => {
          ingredientNames.push(query_res.rows[0].ingredientname);
        });
    }
    bewellIngredients.push(ingredientNames);
  }
  // Treat
  treat = [];
  treatIngredients = [];
  await pool
    .query(
      "SELECT * FROM menuitems WHERE itemcategory = 'Treat' ORDER BY itemid ASC"
    )
    .then((query_res) => {
      for (let i = 0; i < query_res.rowCount; i++) {
        treat.push(query_res.rows[i]);
      }
    });
  for (let i = 0; i < treat.length; i++) {
    let itemID = treat[i].itemid;
    let ingredients = [];
    await pool
      .query(
        `SELECT ingredientid, quantity FROM ingredientsforitem WHERE itemid = ${itemID}`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          ingredients.push(query_res.rows[i].ingredientid);
        }
      });
    let ingredientNames = [];
    for (let i = 0; i < ingredients.length; i++) {
      let ingredientID = ingredients[i];
      await pool
        .query(
          `SELECT * FROM maininventory WHERE ingredientid = ${ingredientID}`
        )
        .then((query_res) => {
          ingredientNames.push(query_res.rows[0].ingredientname);
        });
    }
    treatIngredients.push(ingredientNames);
  }

  res.locals.weightloss = weightloss;
  res.locals.weightlossIngredients = weightlossIngredients;
  res.locals.fitness = fitness;
  res.locals.fitnessIngredients = fitnessIngredients;
  res.locals.bewell = bewell;
  res.locals.bewellIngredients = bewellIngredients;
  res.locals.treat = treat;
  res.locals.treatIngredients = treatIngredients;
  res.locals.orderCustomer = custOrder;

  res.render("customer", res.locals);
});

// POST request for customer page
app.post("/customer", async (req, res) => {
  // check if user removed an item from the order
  if (req.body.removeItem) {
    custOrder.removeItem(req.body.index);
    custOrder.updateTotal();
    res.redirect("/customer");
  }
});

// HANDLE CUSTOMER SMOOTHIE GET REQUEST
// when customer clicks on smoothie in menu, it will load the smoothie page
app.get("/customerSmoothie", async (req, res) => {
  if (req.query.itemname) {
    let itemName = req.query.itemname;
    for (let i = 0; i < itemName.length; i++) {
      if (itemName[i] == "*") {
        itemName = itemName.substring(0, i) + " " + itemName.substring(i + 1);
      }
    }

    let itemID = 0;
    let price = 0;
    await pool
      .query(`SELECT * FROM menuitems WHERE itemname = '${itemName}'`)
      .then((query_res) => {
        itemID = query_res.rows[0].itemid;
        price = query_res.rows[0].price;
      });
    let ingredients = [];
    let quanities = [];
    await pool
      .query(
        `SELECT ingredientid, quantity FROM ingredientsforitem WHERE itemid = ${itemID}`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          ingredients.push(query_res.rows[i]);
        }
      });
    let ingredientNames = [];
    for (let i = 0; i < ingredients.length; i++) {
      let ingredientID = ingredients[i].ingredientid;
      quanities.push(ingredients[i].quantity);
      await pool
        .query(
          `SELECT * FROM maininventory WHERE ingredientid = ${ingredientID}`
        )
        .then((query_res) => {
          ingredientNames.push(query_res.rows[0].ingredientname);
        });
    }
    // get any ingredients that are have 'enhancer' in their ingredient name from main inventory and add to enhancers list
    let enhancers = [];
    let enhancerPrices = [];
    await pool
      .query(`SELECT * FROM maininventory WHERE ingredienttype = 'Enhancer'`)
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          enhancers.push(query_res.rows[i].ingredientname);
          enhancerPrices.push(query_res.rows[i].ingredientprice);
        }
      });
    // get any ingredients that are have 'Protein' as their ingredienttype from main inventory and add to protein list
    let protein = [];
    let proteinPrices = [];

    await pool
      .query(`SELECT * FROM maininventory WHERE ingredienttype = 'Protein'`)
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          protein.push(query_res.rows[i].ingredientname);
          proteinPrices.push(query_res.rows[i].ingredientprice);
        }
      });

    // get any ingredients that are have 'Fruit or Vegetable' as their ingredienttype from main inventory and add to fruit_vegatable list
    let fruit_vegetable = [];
    let fruit_vegetablePrices = [];
    await pool
      .query(
        `SELECT * FROM maininventory WHERE ingredienttype = 'Fruit or Vegetable'`
      )
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          fruit_vegetable.push(query_res.rows[i].ingredientname);
          fruit_vegetablePrices.push(query_res.rows[i].ingredientprice);
        }
      });
    // get any ingredients that have extras as their ingredienttype from main inventory and add to extras list
    let extras = [];
    let extrasPrices = [];
    await pool
      .query(`SELECT * FROM maininventory WHERE ingredienttype = 'Extra'`)
      .then((query_res) => {
        for (let i = 0; i < query_res.rowCount; i++) {
          extras.push(query_res.rows[i].ingredientname);
          extrasPrices.push(query_res.rows[i].ingredientprice);
        }
      });

    res.locals.ingredients = ingredients;
    res.locals.ingredientNames = ingredientNames;
    res.locals.itemname = itemName;
    res.locals.price = price;
    res.locals.quanities = quanities;
    res.locals.enhancers = enhancers;
    res.locals.enhancerPrices = enhancerPrices;
    res.locals.protein = protein;
    res.locals.proteinPrices = proteinPrices;
    res.locals.fruit_vegetable = fruit_vegetable;
    res.locals.fruit_vegetablePrices = fruit_vegetablePrices;
    res.locals.extras = extras;
    res.locals.extrasPrices = extrasPrices;

    res.locals.orderCustomer = custOrder;

    try {
      res.render("customerSmoothie", res.locals);
    } catch (err) {
      console.log(err);
    }
  } else {
    // redirect to server page
    res.redirect("/customer");
  }
});

// handle POST request for customer smoothie page
app.post("/customerSmoothie", async (req, res) => {
  // if user clicks add to cart it creates the object with data and sends here and adds to order
  if (req.body.addItem) {
    let item = new customerMenuItem(
      req.body.smoothieName,
      Number(req.body.smoothiePrice),
      req.body.removeIngredients,
      req.body.enhancers,
      req.body.enhancersPrices,
      req.body.proteins,
      req.body.proteinsPrices,
      req.body.fruits,
      req.body.fruitsPrices,
      req.body.extras,
      req.body.extrasPrices
    );

    // add item to order
    custOrder.addItem(item);
  }

  // check if user removed an item from the order
  if (req.body.removeItem) {
    custOrder.removeItem(req.body.index);
    custOrder.updateTotal();
    res.redirect("/customerSmoothie");
  }
});

// handle GET request for customer checkout page
app.get("/customerCheckoutForm", async (req, res) => {
  res.locals.orderCustomer = custOrder;
  if (req.query.firstName) {
    let firstName = req.query.firstName;
    let lastName = req.query.lastName;
    let phone = req.query.phone;
    let email = req.query.email;

    custOrder.customerName = firstName + " " + lastName;
    custOrder.customerPhone = phone;
    custOrder.customerEmail = email;
    let dateTime = new Date();
    custOrder.startTime = dateTime.toISOString().substring(11, 19);
    custOrder.orderDate = dateTime.toISOString().substring(0, 10);

    submittedOrders.push(custOrder);
    custOrder = new customerOrder();

    res.redirect("/customer");
  } else {
    res.render("customerCheckoutForm", res.locals);
  }
});

// handle POST request for customer checkout page
app.post("/customerCheckoutForm", async (req, res) => {
  // check if user removed an item from the order
  if (req.body.removeItem) {
    custOrder.removeItem(req.body.index);
    custOrder.updateTotal();
    res.redirect("/customerSmoothie");
  }
  if (req.body.submitOrder) {
    res.locals.orderCustomer = custOrder;
    res.render("orderConfirmation", res.locals);
  }
});

// make a page for order confirmation
app.get("/orderConfirmation", async (req, res) => {
  res.locals.customerOrder = custOrder;
  res.redirect("/customer");
});

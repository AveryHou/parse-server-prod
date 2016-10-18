/***
 * local util function
 **/
 
exports.formattedItem = function prepareItem(item, cart) {
	var cartOwner = cart.get("owner");
	var food = item.get("meal");
	var itemObj = {};
	itemObj.foodName = food.get("mealName");
	itemObj.unitPrice = item.get("unitPrice");
	itemObj.qty = item.get("qty");
	itemObj.subTotal = item.get("subTotal");
	itemObj.foodDesc = item.get("itemNameForDisplay");
	itemObj.itemKey = item.get("itemKey");
	itemObj.itemId = item.id;
	itemObj.other =  item.get("other");
	
	var itemOwner = item.get("owner");
	itemObj.ownerContact = itemOwner.get("contact");
	itemObj.ownerPhone = itemOwner.getUsername();
	itemObj.ownerId = itemOwner.id;
	itemObj.owner = itemOwner;
	
	if(cartOwner.id == itemOwner.id) {
		itemObj.note = "";
	} else {
		itemObj.note = "(跟團)";
	}
	
	
	var itemKeyArray = item.get("itemKey").split(",");
	var displayNameArray = item.get("itemNameForDisplay").split(",");
	var attributedArray = [];
	for(var k=0 ; k<itemKeyArray.length ; k++) {
		if(itemKeyArray[k] == "") continue;
		
		var colorObj = {};
		colorObj.keyName = itemKeyArray[k];
		colorObj.valueName = displayNameArray[k];
		attributedArray.push(colorObj);
	}
	itemObj.coloredDesc = attributedArray;
	return itemObj;
}

exports.initJSStore = function prepareStore(store, item, itemJSObj) {
	var storeObj = {};
	storeObj.store = JSON.parse(JSON.stringify(store));
	storeObj.sumOfStore = item.get("subTotal");
	storeObj.shoppingItems = [itemJSObj];
	storeObj.inCart = item.get("shoppingCart");
	
	//for ios display
	storeObj.hbstore = store;
	storeObj.shoppingItemsObj = [item]; 
	return storeObj;
}

exports.updateJSStore = function updateStore(storeJSObj, item, itemObj) {
	var currentSum = storeJSObj.sumOfStore;
	storeJSObj.sumOfStore = currentSum + item.get("subTotal");
	storeJSObj.shoppingItems.push(itemObj);
	storeJSObj.shoppingItemsObj.push(item);
	return storeJSObj;
}

//運費計算
exports.calShippingFee = function calShippingFee(totalFoodPrice, storeCount) {
	var base = 130;	//基本運費
	var subsidy = base * 0.5; //公司補貼一半
	var userPay = base - subsidy; //使用者負擔運費
	
	//讓利
	var profit = totalFoodPrice * 0.12; // 12% 利潤
	if (profit - (base - subsidy) < 0) {
		userPay += Math.abs(profit - (base - subsidy));
	}
	
	var extraStore = (storeCount - 1) * 15; //多一個店家多15元
	//extraStore = 0; 
	userPay += extraStore;
	return Math.ceil(userPay);
}


//運費計算
exports.calShippingFee_new = function calShippingFee_new(itemsFound, storeCount) {
	var base = 150;	//基本運費
	var extraStore = (storeCount - 1) * 15; //多一個店家多15元
	var maxUserPay = base + extraStore;
	
	var storeIdArray = [];
	var storeObjArray = [];
	var foodPriceArray = [];
	for(var i=0 ; i<itemsFound.length ; i++) {
		var oneItem = itemsFound[i];
		var storeId = oneItem.get("store").id;
		var idx = storeIdArray.indexOf(storeId);
		if (idx == -1) { //店家尚未存在
			storeIdArray.push(storeId);
			storeObjArray.push(oneItem.get("store"));
			foodPriceArray.push(oneItem.get("subTotal"));
		} else {
			var currentFoodPrice = foodPriceArray[idx];
			currentFoodPrice = currentFoodPrice + oneItem.get("subTotal");
			foodPriceArray[idx] = currentFoodPrice;
		}
	}
	console.log("foodPriceArray:" + foodPriceArray);
	
	//計算店家支付
	var totalStorePay = 0;
	for(var i=0 ; i<storeObjArray.length ; i++) {
		var storeShouldPay = 0;
		var store = storeObjArray[i];
		var storeAt = storeIdArray.indexOf(store.id);
		var foodPriceOfStore = foodPriceArray[storeAt];
		
		var maxScore = store.get("maxScore");
		var minScore = store.get("minScore");
		if (foodPriceOfStore >= maxScore) {
			storeShouldPay = 150;
		} else if (foodPriceOfStore <= minScore) {
			storeShouldPay = 0;
		} else {
			var ratio = ((foodPriceOfStore - minScore) / (maxScore - minScore)); //店家與客人按比例分攤運費
			ratio = ratio.toFixed(3); //小數點取三位
			storeShouldPay = Math.round(base * ratio); //四捨五入
		}
		console.log(store.get("storeName") + ", foodPrice:" + foodPriceOfStore + ", 店家負擔:" + storeShouldPay);
		totalStorePay = totalStorePay + storeShouldPay;
	}
	console.log("店家付:" + totalStorePay + ",消費者應付:" + maxUserPay);
	
	var userPay = 0;
	if (totalStorePay < maxUserPay) { //店家支付小於消費者應付
		userPay = maxUserPay - totalStorePay;	
	}
	console.log("消費者實付:" + userPay);
	
	return userPay;
}

exports.currentDate = function currentDate() {
	var currentDate = new Date();
	var currentMonth = currentDate.getMonth() + 1;
    var fMonth = currentMonth + "";
    if (currentMonth < 10) {
    	fMonth = "0" + fMonth;
    } 
    
	var currentDay = currentDate.getDate();
    var fDay = currentDay + "";
	if (currentDay < 10) {
    	fDay = "0" + fDay;
    } 
    
    return fMonth + "/" + fDay;	
}

exports.getTotalFoodPrice = function getTotalFoodPrice(foodObj, foodSizeSelected, cupSizeSelected, foodAdditions, largeFoodAdditions) {
	var foodPrice = foodObj.get("price");
	if (foodSizeSelected == "10" || cupSizeSelected == "10") { //餐點選大份或大杯
		foodPrice += foodObj.get("extraPriceForSize");
	}
	
	if (foodAdditions != "" && foodAdditions != null && foodAdditions != 'undefined') {
		foodPrice += foodObj.get("extraPriceForAdditions") * foodAdditions.length;
	}
	
	if (largeFoodAdditions !="" && largeFoodAdditions != null && largeFoodAdditions != 'undefined') {
		foodPrice += foodObj.get("extraPriceForLargeAdditions") * largeFoodAdditions.length;
	}
	
    return foodPrice;
}

exports.foodPickupCode = function foodPickupCode(id) {
	var length = id.length;
    console.log("length = " + length);

    var n = 0;
    var m = 0;

    for (var i = 0; i < length; i++) {
        n += (i + 1) * id.charCodeAt(i);
        m += (length - i) * id.charCodeAt(i);
    }

    n = n % 100;
    m = m % 100;

    var code = n * 100 + m;
    var codeStr = code.toString();

    for (var i = 0, difLen = (4 - codeStr.length) ; i < difLen; i++) {
        codeStr = "0" + codeStr;
    }

    return codeStr;
}
/** Node CLI Parser v1.0	-- circa October 23, 2014
*	When I barely knew what a parser was :)
*/
function cli(options) {
	//default options
	var opts = {
		commands: {},
		src: process.argv.slice(2),
		addDash:  true,
		logOptionErr:  true,
		logInputErr:  false
	};
	//override by passed options
	extend(opts, options);
	//dash command names
	opts.addDash ? dashComms(opts.commands) : void(0);

	var comms = opts.commands;
	var src = opts.src;
	var errQueu = [];
	var ret = {};
	ret.comms = {};
	ret.ign = [];
	//#latebuild
	(function() {
		for(var prop in comms)
			ret.comms[prop] = [];
	}());

	var name;
	var	allow;
	var	bottom;
	var	top;

	while(name = findCommand()) {
		comm = comms[name];
		allow = comm.allow;				
		//none provided, defaults to one exactly
		if((allow === undefined) || ((allow[0] === undefined) && (allow[1] === undefined))) {
			bottom = -1;
			top = 1;
		//only one number, include exactly those many args	
		}else if((allow[0] !== undefined) && (allow[1] === undefined)) {
			top = allow[0];	
			bottom = -1;
		//both allowances explicitly provided
		}else if((allow[0] !== undefined) && (allow[1] !== undefined)){
			bottom = allow[0];
			top = allow[1];
		}
		//else:  debugger for any unanticipated value
		else {
			var debug = "DEBUGGER:  unanticipated value fell through";
			throw debug;
		}
		//invalid allowable number
		if(!checkNum(bottom,top)) {
			err("Option","invalid 'allow' value",false);					
		}
		//else, collect args
		ret.comms[name] = collectArgs(bottom,top);
	}
	//del with ignored args
	if(ret.ign.length > 0)
		err("Input","ignored " + ret.ign.length + " args",true);

	if(errQueu.length) {
		errQueu.forEach(function(el) {
			console.log(el);
		},null);
		//new line
		console.log("");
	}

	return ret;

	//shallow obj extends
	function extend(obj1,obj2) {
		var ownProp = Object.getOwnPropertyNames(obj2);

		ownProp.forEach(function(el,ind,arr) {
			if(obj2.propertyIsEnumerable(el))
				obj1[el] = obj2[el];
		},null);
	}

	//prepend command names with dash
	function dashComms(comms) {
		for(var prop in comms) {
			if(!comms.hasOwnProperty(prop))
				continue;
			if(prop.search(/^-+/) != -1)
				continue;
			//else
			comms["-" + prop] = comms[prop];
			delete comms[prop];
		}
	}

	//is the arg a command?
	function isComm(arg) {
		if(opts.commands[arg] !== undefined)
			return true;
		else
			return false;
	}

	//collect args cascade
	function collectArgs(bottom,top) {
		var ret = [],
			counter = 1,
			arg;
		//required
		while((counter != bottom) && (counter != top +1)) {			
			arg = src.shift();	
		
			if(arg === undefined) {
				err("Input","deficit in requried args",true);//for commmand:  curr command
				break;
			}

			isComm(arg) ? err("Input", arg + " is a command, was used as argument input",true) : void(0);				
			ret.push(arg);
			counter++;
		}
		//optional
		while(counter <= top) {	
			arg = src[0];

			if(arg === undefined)
				break;
			if(matchProperty(arg,comms))
				break;
			//else
			isComm(arg) ? err("Input", arg + " is a command, was used as argument input",true) : void(0);
			ret.push(src.shift());
			counter++;
		}
						
		return ret;										
	}	

	//same:  obj.hasOwnProperty(subj)
	function matchProperty(subj,obj) {
		//or if obj[subj] === undefined; return false
		for(var prop in obj) {
			if(prop == subj)
				return prop;
			else
				continue;
		}

		return false;
	}

	//return next command, ignores non-commands
	function findCommand() {
		var comm;
		
		for(var i = 0, j = src.length; i < j; i++) {
			//no more args
			if(src[0] === undefined)
				return;
			if((comm = matchProperty(src[0],comms)) === false)
				ignoreArg(src.shift());
			else {
				src.shift();
				return comm;
			}
		}
	}

	function ignoreArg(arg) {
		[].push.call(ret.ign,arg);
	}

	function checkNum() {
		a = Array.prototype.slice.call(arguments);
		//check all nums provided, if any is "bad" ret false
		while(a.length) {
			n = a.shift();
			if(typeof n != "number")//12/9/2014:  could have use if(!Number.isFinite(n)) *ESnext
				return false;
			if(isNaN(n) || n === Infinity)//12/9/2014:  could have used if(!isFinite(n))
				return false;
			if(n < -1)
				return false;
		}
		return true;
	}

	//super simple error system:  two poss types(input, option); collects non-urgent errors 
	function err(type,desc,shouldWait) {
		if(!opts["log" + type + "Err"]) 
			return;
		if(!shouldWait) {
			console.log(type + "Error:  " + desc);
			process.exit();
		}
		//else if(shouldWait)
		errQueu.push(type + "Error:  " + desc);		
	}
}

module.exports = cli;


var options = {
	commands: {
		A: {allow: [2,3]},
		B: {allow: [2]},
		C: {allow: [1]}
	},
	logOptErr: true,
	logInputErr: true
};

var args = cli(options);

console.log(args);
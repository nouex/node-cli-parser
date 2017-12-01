/*
* January 5, 2015
* 
* v3.0 expands two capabilities:  type checking (based on nopt), and a possible single command
* All complete.  Future TODO
* 	add more filtering
*/

/* possible opt options so far
* min
* max
* short (arr)
* long (arr)
* def (single val)
* type (array | string)
*
* possible command options so far
* min
* max
* name
* fn
* type (array | string)
*/
//Note:  command defs support an arr, option only one value

"use strict";
var url = require("url");
var path = require("path");
var Stream = require("stream").Stream;

exports = module.exports = nodeParse;
var typeDefs = exports.typeDefs =
  { String  : validateString  
  , Boolean : validateBoolean
  , url     : validateUrl 
  , Number  : validateNumber
  , path    : validatePath 
  , Stream  : validateStream 
  , Date    : validateDate 
  }

function nodeParse(userOpts) {
	return parse(checkUserOpts(userOpts));
}

function checkUserOpts(userOpts) {
	checkOpts(userOpts);

	for(var opt in userOpts.options) {
		checkOpt(userOpts.options[opt], opt);
	}

	return userOpts;

	//add cases for no name no short no long
	function checkOpt(opt, name) {
		//all mainly to save search time
		var short = opt.short,
			long = opt.long,
			min = opt.min,
			max = opt.max,
			type = opt.type;

		short = opt.short = (short) ? [].concat(short) : [];
		long = opt.long = (long) ? [].concat(long) : [];
		if (short.length === 0 && long.length === 0) {
			console.log("Err: must have either a short name or long"); process.exit();
		}
		opt.name = name;
		opt.type = type ? [].concat(type) : [];
		//TODO use ternaries instead
		if (min && max) {
			opt.min = min;
			opt.max = max;
		} else if (max && !min) {
			opt.min = 1;
			opt.max = max;
		} else if (!max && min) {
			opt.min = min;
			opt.max = min;
		} else if (opt.required || (!max && !min)) {
			opt.min = 1;
			opt.max = 1;
		}

		if (min === "*" || max === "*") {
			if (min === "*")
				throw new Error("Cannor have required (min) infinite values");
			//...
		}

		if (opt.min > opt.max)
			throw new RangeError("min is greater than max at " + opt.name);
	}

	function checkOpts(opts) {
		opts.argv = opts.argv || process.argv.slice(2);
		opts.options = opts.options || {};
		"command" in opts ? checkCommand(opts.command) : void null;
	}

	function checkCommand(comm) {
		if (!("name" in comm)) {
			console.log("Error: a command requires a name");
			process.exit();
		}
		comm.fn = comm.fn || Function.prototype;//does nothing
		//"wait" in comm ? comm.wait = comm : comm.wait = false; //not for now, only for command with specific number of args
		comm.type =  Array.isArray(comm.type) ? [].concat(comm.type) : [];
	}
}

//main
function parse(opts) {
	//var opts = arguments["0"];
	var ret;

	opts.argv = normalizeArgv(opts);
	ret = parseOpts(opts);
	//further processing with `ret`, if not:
	return ret;
}

function parseOpts(opts) {
	var argv = opts.argv,
		options = opts.options,
		command = opts.command || null,
		_ignored = [],
		ret = {};

	ret._ignored = _ignored;

	var opt, arg;

	//actual parsing
	while (argv.length !== 0) {
		arg = argv.shift();	
		opt = getOption(arg, options);
		if(opt) {
			ret[opt.name] = collectOptionArgs(options, opt, argv);
		} else if (arg === (command && command.name)) {//TODO fix line below to invoke command fn only after ret has returned or like that
			command.fn.apply(null, collectOptionArgs(command, argv));//remember, must not do anything that requires `ret`, b/c it still hasnt' returned
		}
		else
			_ignored.push(arg);
	}

	return ret;
}

function normalizeArgv(opts) {
	var argv = opts.argv,
		options = opts.options,
		ret = [];

	var arg, equalIndex, noIndex, flag, no,
		/*for case 4 mainly*/opt, lastIndex, case3RegExp;

	for (var i = 0, len = argv.length; i !== len; i++) {
		arg = argv[i];

		switch (getCase(arg)) {
			case 0://value
			ret.push(arg);
			break;

			case 1://--longhand
			ret.push(arg);
			break;

			case 2://--longhand=value
			equalIndex = arg.indexOf("=");
			ret.push(arg.slice(0, equalIndex));
			ret.lpush(arg.slice(equalIndex));
			break;

			case 3://--no-longhand | --no-shorhtand
			no = (opt = getOption(arg) ? opt.def : true);

			case3RegExp = /no-/g;
			while(case3RegExp.exec(arg)) {
				no = !no;
				lastIndex = case3RegExp.lastIndex;
			}

			ret.push(arg.slice(lastIndex -1));
			ret.push(no);
			break;

			case 4://-shorthand
			ret.push(arg);
			break;

			case 5://-abc merged
			arg.slice(1).split("").forEach(function(char) {
				ret.push("-" + char);
			}, null);
			break;

			case 6://option terminator
			ret.concat(argv.slice(i));

			default:
			throw new TypeError("Unexpected type case issued");
		}
	}

	return ret;

	function getCase(arg) {
		var equalIndex;

		if (arg === "--") {
			return 6;//option terminator
		} else if (~(arg.indexOf("no-"))) {
			return 3;
		} else if (/^--/.test(arg)) {//begins with `--`
			//has equals
			if (~(arg.indexOf("="))) {
				return 2;//--fullname=value
			} else
				return 1;
		} else if (arg.length > 1 && "-" === arg[0] && "-" !== arg[1]) {//starts with `-`
			if (getOption(arg, options)) {//it's a shorthand
				return 4;
			} else {
				return 5;//-abc											
			}
		} else //a value
			return 0;
	}
}

//cascading collection
//TODO clean it up (variable), got messy when command mode and normal mode diverged
function collectOptionArgs(options, opt, from) {
		var count = 1,
			def = opt.def,
			comm = null,
			ret = [];

		var min,
			max,
			isInfinite,
			type,//an array
			arg;

	//go into command mode
	if (arguments.length === 2) {
		//rearrange arguments
		comm = options;
		from = opt;
		min = 0;//never goes into required
		max = "*";//is infinite, eat up all args for the command
		isInfinite = true;
		type = comm.type;
		options = {};
	} else {
		min = opt.min;
		max = opt.max;
		max === "*" ? isInfinite = true : void 0;
		type = opt.type;
		def = opt.def;
		isInfinite = false;//haw way of chaging
	}

		//required range:  min and below
		while (count <= min) {
			//filters
			//if no more
			//else if it's an option
			//else push it
			if (!("0" in from)) {//if (from[0] === undefined)
				if (def) {
					ret.push(def);
				} else
					throw new Error("Required arg for " + opt.name + " missing");
			} else if (getOption(from[0], options)) {
				if (def) {
					ret.push(def);
				} else
					throw new Error("A required arg was expected, got option " + arg.name);
			} else {
				arg = from.shift();
				//automatically check type even if none specified, error if bad type
				ret.push(validate(arg, type));
			}

			count++;
		}
		//optional range
		while (count <= max || isInfinite) {
			//TODO use if elsefi else to be compat with above `with`
			//check if no more
			if(!("0" in from))
				break;

			arg = from.shift();

			if(getOption(arg, options)) {
				from.unshift(arg);
				break;
			}
			//else
			ret.push(validate(arg, type));
			count++;
		}

		return ret;
}

//key, opts.options
function getOption(key, from) {
	var match = false;

	for(var prop in from) {
		if (match)
			break;
		if (from.hasOwnProperty(prop)) {
			from[prop].long.concat(from[prop].short).forEach(function(el) {
				if (el === key)
					match = from[prop];
			}, null);
		}
	}

	return match;
}

//validate functions
function validate(arg, types) {
	var result, type;

	if (!types.length)
		return arg;
	for (var i in types) {
		type = types[i];
		if (!type in typeDefs)
			throw new TypeError(type + " as a type does not exist");
		result = typeDefs[type](arg);
		if (result[0])
			return result[1];
		//else
		//continue
	}
	//bad type
	throw new Error("Bad type: " + arg + ", expected possible types: " + types);
	process.exit();
	//return;
}

function validateString (val) {
	//boolean compatability; first is to tell validate if it is of correct type, second is the type (converted)
  return [true, String(val)];
}

function validatePath (val) {
  if (val === true) return [false];
  if (val === null) return [true];

  val = String(val)
  var homePattern = process.platform === 'win32' ? /^~(\/|\\)/ : /^~\//
  if (val.match(homePattern) && process.env.HOME) {
    val = path.resolve(process.env.HOME, val.substr(2))
  }
  val = path.resolve(String(val));
  return [true, val];
}

function validateNumber (val) {
  if (isNaN(val)) return [false];
  //else
  return [true, +val];  
}

function validateDate (val) {
  var s = Date.parse(val)
  if (isNaN(s)) return [false];
  //else
	return [true, s];
}

function validateBoolean (val) {
  switch (val) {
  	case "true":
  	case "TRUE":
  	case "yes":
  	case "YES":
  	return [true, true];
  	case "false":
  	case "FALSE":
  	case "no":
  	case "NO":
  	return [true, false];
  	default:
  	return [false, null];
  }
}

function validateUrl (val) {
  val = url.parse(String(val))
  if (!val.host) return [false, null];
  //else
  return [true, val];  
}

function validateStream (val) {
  if (!(val instanceof Stream)) return [false, null];
  //else
  return [true, val];
}
/** Node CLI Parser v2.0	--	December 23, 2014
*	Finished January 4, 2015
*	After reading five different parsers from GitHub I learned...
*		-	An option has an associated value
*			-	--topping	(full name aka longhand)
*			-	--topping=cheese	(full name w value)
*			-	-t 	(shorthand aka abbreviation)
*			-	--no-salt	(negated)
*			-	-abc	(comgined flags)
*			-	--	(option terminator)
*		-	Some parsers allow commands which may also have their options, there's usually only one command per execution
*		-	-	make_pizza (notice commands aren't hashed)
*
*		e.g 	make_pizza --topping cheese -topping=pepper -t onions --no-salt
*
*/

"use strict";

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
			max = opt.max;

		short = opt.short = (short) ? [].concat(short) : [];
		long = opt.long = (long) ? [].concat(long) : [];
		opt.name = name;
		//use ternaries instead
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

			case 6://option terminator
			ret.concat(argv.slice(i));
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
			if (getOption(arg)) {//it's a shorthand
				return 4;
			} else {//-abc
				return 5;//-abc
			}
		} else //a value
			return 0;
	}
}

//cascading collection
function collectOptionArgs(options, opt, from) {
	//to get around `min = opt.min || -1` when min is 0
	var min = opt.min,
		max = opt.max,
		count = 1,
		def = opt.def,
		isInfinite = false,
		ret = [];

	var arg;

	max === "*" ? isInfinite = true : void 0;
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
			} else
				ret.push(from.shift());

			count++;
		}
		//optional range
		while (count <= max || isInfinite) {
			//check if no more
			if(!("0" in from))
				break;

			arg = from.shift();

			if(getOption(arg, options)) {
				from.unshift(arg);
				break;
			}

			ret.push(arg);
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

exports = module.exports = nodeParse;
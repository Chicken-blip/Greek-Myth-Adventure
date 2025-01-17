// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'Beginning';
squiffy.story.id = '5badec443d';
squiffy.story.sections = {
	'': {
		'clear': true,
		'text': "",
		'attributes': ["brotherName = Alfred","homeTown = Bethens"],
		'passages': {
		},
	},
	'Beginning': {
		'text': "<p>You wake up, lying against a tree. You begin to stretch, working out the exhaustion from your limbs. You&#39;ve walked for three days straight, so this rest was very overdue.</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Go back to sleep\" role=\"link\" tabindex=\"0\">Go back to sleep</a></li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Look around you\" role=\"link\" tabindex=\"0\">Look around you</a></li>\n</ol>",
		'passageCount': 2,
		'passages': {
			'Look around you': {
				'text': "<p>You observe your surroundings. To your right, your brother, {brotherName}, is keeping watch. Though, you had little faith in him protecting you. The both of you were in a forest, surrounded by trees. Thankfully, it didn&#39;t seem like anyone has been here since you two arrived at this point.</p>",
			},
			'Go back to sleep': {
				'text': "<p>You begin to close your eyes again, drifting off to sleep. Your brother chastises you, &quot;Don&#39;t fall asleep again, brother. You&#39;ve had a good enough rest. We should start going.&quot;</p>",
			},
			'@last': {
				'text': "<p><a class=\"squiffy-link link-section\" data-section=\"Get up\" role=\"link\" tabindex=\"0\">Get up</a></p>",
			},
		},
	},
	'Get up': {
		'text': "<p>You stand up, and start towards your brother. He gestures for you to wait. &quot;Hold on, let me check you up again.&quot; You sigh. He already did that before you slept, but you conceed regardless. He looks you over, before concluding no wounds or bruises were found. &quot;I think we should start walking again. The city should be nearby now.&quot;</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Try to remember what happened\" role=\"link\" tabindex=\"0\">Try to remember what happened</a></li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Ask {brotherName} where you're going\" role=\"link\" tabindex=\"0\">Ask {brotherName} where you&#39;re going</a></li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Threaten {brotherName}\" role=\"link\" tabindex=\"0\">Threaten {brotherName}</a></li>\n</ol>",
		'passages': {
			'Try to remember what happened': {
				'text': "<p>You try to jog your memory as to how you got here. You recall running away from your hometown, {homeTown}. It&#39;s starting to come back to you, but <a class=\"squiffy-link link-passage\" data-passage=\"Think some more\" role=\"link\" tabindex=\"0\">you need a bit more time</a>.</p>",
			},
			'Think some more': {
				'text': "<p>You think a bit more about what happened. You were running away, fleeing the entire kingdom...because the king was killed. You still don&#39;t know the details, but you heard rumors that is was an extremist group who were greatly dissatified. You were only able to escape with your brother, as your parents were killed alongside the rest of the kingdom. You&#39;ve remembered more, but <a class=\"squiffy-link link-passage\" data-passage=\"Think harder\" role=\"link\" tabindex=\"0\">you need to think harder</a>.</p>",
			},
			'Think harder': {
				'text': "<p>You were only able to rescue your brother when they came in. You held your own, carrying your brother out on your shoulders. It was exhausting, but you had no choice. You promised your parents that you would protect him with your life. That sounds like all you need to recall for now. You should continue your mission.</p>",
			},
			'Ask Alfred where you\'re going': {
				'text': "<p>Your brother explains. &quot;We&#39;re headed to the neighboring kingdom, seeking refuge. We don&#39;t need anything major; just a place to hide away from those killers, got it?&quot; He spoke to you, as if you were a child. It irritated you, but you bit back any comment.<br>\n<a class=\"squiffy-link link-section\" data-section=\"Start to lead the way\" role=\"link\" tabindex=\"0\">Start to lead the way</a></p>",
			},
			'Threaten Alfred': {
				'text': "<p>You raise your spear and aim it at your brother. He backs away, terrified. &quot;H-hey, chill, would you? You promised that you wouldn&#39;t joke like that anymore!&quot; You cursed under your breath, bringing your spear back down. Maybe next time.</p>",
			},
		},
	},
	'Start to lead the way': {
		'text': "<p>You and your brother head back onto the trail. You keep a keen eye out, making sure nobody rushes the two of you. After some time, you come across someone, lying on the side of the road. They don&#39;t appear to be conscious, and there&#39;s a faint red stain on their tunic.</p>\n<ol>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Talk to {brotherName}\" role=\"link\" tabindex=\"0\">Talk to {brotherName}</a></li>\n<li><a class=\"squiffy-link link-passage\" data-passage=\"Look at the person\" role=\"link\" tabindex=\"0\">Look at the person</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Help the person\" role=\"link\" tabindex=\"0\">Help the person</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Walk past the person\" role=\"link\" tabindex=\"0\">Walk past the person</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Kill the person\" role=\"link\" tabindex=\"0\">Kill the person</a></li>\n</ol>",
		'passages': {
			'Talk to Alfred': {
				'text': "<p>Your brother shrugs. &quot;Could be a trap, could be a lost cause. Either way, we shouldn&#39;t spend any time with &#39;em. They&#39;ll die anyway.&quot;</p>",
			},
			'Look at the person': {
				'text': "<p>You take a closer look at the wounded individual. Their breathing is shallow, and their injury is a deep cut to the abdomen. Their eyes have glazed over; they don&#39;t take any notice of you. Must have been an ambush.</p>",
			},
		},
	},
	'Help the person': {
		'text': "<p>You get close to the person, before slinging them over your shoulder. Your brother shakes his head. &quot;You&#39;re wasting your time, brother. He&#39;ll die soon anyway.&quot;<br>\n<a class=\"squiffy-link link-passage\" data-passage=\"Heal person\" role=\"link\" tabindex=\"0\">&quot;Not if you save him&quot;</a><br>\n<a class=\"squiffy-link link-passage\" data-passage=\"Drop person\" role=\"link\" tabindex=\"0\">&quot;Fine then&quot;</a></p>",
		'passages': {
		},
	},
	'Heal person': {
		'text': "<p>Your brother rolls his eyes. &quot;Fine, but only because you said so. Keep guard while I treat him.&quot; You not, pulling out your spear while {brotherName} crouches down by the person. He keeps muttering nonsense under his breath, but he eventually finishes bandaging the injury. Luckily, no enemies showed up. He gets up again, &quot;There, happy? All patched up, but not waking up anytime soon. Let&#39;s go, already!&quot; You nod, the both of you continuing on your way to the new kingdom.<br>\n<a class=\"squiffy-link link-section\" data-section=\"Continue\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'Drop person': {
		'text': "<p>You put the person down again. If your brother says they&#39;re a lost cause, it must be true. The both of you continue on your way to the new kingdom.<br>\n<a class=\"squiffy-link link-section\" data-section=\"Continue\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'Walk past the person': {
		'text': "<p>You disregard the wounded person, walking past with your brother. If he&#39;s lying there, he may not be able to wake up, even if you do help him. &quot;Good choice, brother,&quot; _ confirms. &quot;We would have been wasting time with him.&quot; With that, the both of you continue on your way to the new kingdom.<br>\n<a class=\"squiffy-link link-section\" data-section=\"Continue\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'Kill the person': {
		'text': "<p>You approach the person, raising your spear. They don&#39;t flinch as you slice their neck, ensuring a quick death. &quot;I suppose,&quot; your brother says, &quot;it is better for him to not suffer.&quot; You and your brother continue on your way to the new kingdom.<br>\n<a class=\"squiffy-link link-section\" data-section=\"Continue\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'Continue': {
		'text': "<p>End of story so far.\nGood job!<br>\nStay tuned for more updates!</p>",
		'passages': {
		},
	},
}
})();
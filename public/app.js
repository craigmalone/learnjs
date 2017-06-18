'use strict';

var learnjs = {};

/* ==================  Data =====================  */

learnjs.problems = [
    {
        description: "What is truth?",
        code: "function problem() { return __; }"
    },
    {
        description: "Simple Math",
        code: "function problem() { return 42 === 6 * __; }"
    }
];

/* ==================== Utility Functions ================= */

learnjs.applyObject = function(obj, elem) {
    for (var key in obj) {
        elem.find('[data-name="' + key + '"]').text(obj[key]);
    }
};

learnjs.flashElement = function(elem, content){
    elem.fadeOut('fast', function() {
        elem.html(content);
        elem.fadeIn();
    });
};

learnjs.template = function(name) {
    return $('.templates .' + name).clone();
};

learnjs.triggerEvent = function(name, args) {
    $('.view-container>*').trigger(name, args);
}

/* ==================== Problem app functions ============= */

learnjs.buildCorrectFlash = function (problemNum) {
    var correctFlash = learnjs.template('correct-flash');
    var link = correctFlash.find('a');
    if (problemNum < learnjs.problems.length) {
        link.attr('href', '#problem-' + (problemNum + 1));
    } else {
        link.attr('href', '');
        link.text("You're Finished!");
    }
    return correctFlash;
}

learnjs.problemView = function(data) {
    var problemNumber = parseInt(data, 10);
    var view = $('.templates .problem-view').clone();
    var problemData = learnjs.problems[problemNumber - 1];
    var resultFlash = view.find('.result');

    if (problemNumber < learnjs.problems.length) {
        var buttonItem = learnjs.template('skip-btn');
        buttonItem.find('a').attr('href', '#problem-' + (problemNumber + 1));
        $('.nav-list').append(buttonItem);
        view.bind('removingView', function() {
            buttonItem.remove();
        });
    }

    function checkAnswer() {
        var answer = view.find('.answer').val();
        var test = problemData.code.replace('__', answer) + '; problem();';
        var evaled = eval(test);
        return evaled;
    }

    function checkAnswerClick() {
        if (checkAnswer()) {
            var correctFlash = learnjs.template('correct-flash');
            correctFlash = learnjs.buildCorrectFlash(problemNumber);
            learnjs.flashElement(resultFlash, correctFlash);
        } else {
            learnjs.flashElement(resultFlash, 'Incorrect!');
        }
        return false;
    }

    view.find('.check-btn').click(checkAnswerClick);
    view.find('.title').text('Problem #' + problemNumber);
    learnjs.applyObject(problemData, view);
    return view;
};

learnjs.landingView = function() {
    return learnjs.template('landing-view');
}

learnjs.showView = function(hash) {
    var routes = {
        '#problem': learnjs.problemView,
        '#': learnjs.landingView,
        '': learnjs.landingView
    };

    var hashParts = hash.split('-');
    var viewFn = routes[hashParts[0]];
    if (viewFn) {
        learnjs.triggerEvent('removingView', []);
        $('.view-container').empty().append(viewFn(hashParts[1]));
    }
};


/* ===========================  Main ================= */

learnjs.appOnReady = function() {
    window.onhashchange = function() {
        learnjs.showView(window.location.hash);
    };
    learnjs.showView(window.location.hash);
};

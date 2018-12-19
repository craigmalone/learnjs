'use strict';

var learnjs = {
    poolId: 'us-east-1:567ff82e-f80d-4711-aee5-1a6b3c588d4c'
};

learnjs.identity = new $.Deferred();

/* ==================  Data =====================  */

learnjs.problems = [
    {
        description: "According to the front page of the Bedford News, March 24, 1932?",
        code: "How much is a new ABC Electric Washer?"
    },
    {
        description: "Simple Math",
        code: "function problem() { return 42 === 6 * __; }"
    }
];

/* ==================== Cognito and Google  ============ */

learnjs.awsRefresh = function() {
    var deferred = new $.Deferred();
    AWS.config.credentials.refresh(function(err) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(AWS.config.credentials.identityId);
        }
    });
    return deferred.promise();
};

/* Cant be part of learnjs namespace */


function googleSignIn(googleUser) {
    function refresh() {
        return gapi.auth2.getAuthInstance().signIn({
            prompt: 'login'
        }).then(function(userUpdate) {
            console.log("refresh(): updating token.")
            var creds = AWS.config.credentials;
            var newToken = userUpdate.getAuthResponse().id_token;
            creds.params.Logins['accounts.google.com'] = newToken;
            return learnjs.awsRefresh();
        });
    }

    var id_token = googleUser.getAuthResponse().id_token;
    var expires_in = googleUser.getAuthResponse().expires_in;
    console.log("googleSignIn(): id_token=" + id_token + " expires_in=" + expires_in);
    AWS.config.update({
        region: 'us-east-1',
        credentials: new AWS.CognitoIdentityCredentials({
            IdentityPoolId: learnjs.poolId,
            Logins: {
                'accounts.google.com': id_token
            }
        })
    });

    /* After setting up the config, want to refresh the Cognito credentials. When this is done resolve the identity */
    learnjs.awsRefresh().then(function(id) {
        learnjs.identity.resolve({
            id: id,
            email: googleUser.getBasicProfile().getEmail(),
            refresh: refresh
        });
    });
}

/* ===================== DynamoDB functions =============== */

learnjs.sendDbRequest = function(req, retry) {
    var promise = new $.Deferred();
    req.on('error', function(error) {
        if (error.code === "CredentialsError") {
            learnjs.identity.then(function(identity) {
                return identity.refresh().then(function() {
                    return retry();
                }, function() {
                    promise.reject(resp);
                });
            });
        } else {
            promise.reject(error);
        }
    });
    req.on('success', function(resp) {
        promise.resolve(resp.data);
    });
    req.send();
    return promise;
};

learnjs.countAnswers = function(problemId) {
    return learnjs.identity.then(function(identity) {
        var db = new AWS.DynamoDB.DocumentClient();
        var params = {
            TableName: 'learnjs',
            Select: 'COUNT',
            FilterExpression: 'problemId = :problemId',
            ExpressionAttributeValues: {':problemId': problemId}
        };
        return learnjs.sendDbRequest(db.scan(params), function() {
            return learnjs.countAnswers(problemId);
        });
    });
}

learnjs.saveAnswer = function(problemId, answer) {
    console.log("Saving answer: " + answer);
    return learnjs.identity.then(function(identity) {
        var db = new AWS.DynamoDB.DocumentClient();
        var item = {
            TableName: 'learnjs',
            Item: {
                userId: identity.id,
                problemId: problemId,
                answer: answer
            }
        };
        return learnjs.sendDbRequest(db.put(item), function() {
            return learnjs.saveAnswer(problemId, answer);
        });
    });
};


learnjs.fetchAnswer = function(problemId) {
    console.log("fetchAnswer(): problemId=" + problemId);
    return learnjs.identity.then(function(identity) {
        var db = new AWS.DynamoDB.DocumentClient();
        var item = {
            TableName: 'learnjs',
            Key: {
                userId: identity.id,
                problemId: problemId
            }
        };
        return learnjs.sendDbRequest(db.get(item), function() {
            return learnjs.fetchAnswer(problemId);
        });
    });
};

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
        link.attr('href', 'https://s3-ap-southeast-2.amazonaws.com/nicheware-family/media/pdf/363/Karen-2017-Xmas.pdf');
    } else {
        link.attr('href', '');
        link.text(" You're Finished!");
    }
    return correctFlash;
}

learnjs.addProfileLink = function(profile) {
    var link = learnjs.template('profile-link');
    link.find('a').text(profile.email);
    $('.signin-bar').prepend(link);
}

/* ===================== View functions ================== */

learnjs.problemView = function(data) {
    var problemNumber = parseInt(data, 10);
    var view = $('.templates .problem-view').clone();
    var problemData = learnjs.problems[problemNumber - 1];
    var resultFlash = view.find('.result');
    var answer = view.find('.answer');

    function checkAnswer() {
        /*
        var test = problemData.code.replace('__', answer.val()) + '; problem();';
        console.log("checkAnswer(): test=" + test);
        var evaled = eval(test);
         */
        var evaled = answer.val() === "99"
        return evaled;
    }

    function checkAnswerClick() {
        if (checkAnswer()) {
            var flashContent = learnjs.buildCorrectFlash(problemNumber);
            learnjs.flashElement(resultFlash, flashContent);
            learnjs.saveAnswer(problemNumber, answer.val());
        } else {
            learnjs.flashElement(resultFlash, 'Incorrect!');
        }
        return false;
    }

    if (problemNumber < learnjs.problems.length) {
        var buttonItem = learnjs.template('skip-btn');
        buttonItem.find('a').attr('href', '#problem-' + (problemNumber + 1));
        $('.nav-list').append(buttonItem);
        view.bind('removingView', function() {
            buttonItem.remove();
        });
    }

    learnjs.fetchAnswer(problemNumber).then(function(data) {
        if (data.Item) {
            /* answer.val(data.Item.answer); */
            answer.val("");
        }
    });

    view.find('.check-btn').click(checkAnswerClick);
    view.find('.title').text('Problem #' + problemNumber);
    learnjs.applyObject(problemData, view);
    return view;
};

learnjs.landingView = function() {
    return learnjs.template('landing-view');
}

learnjs.profileView = function() {
    var view = learnjs.template('profile-view');
    learnjs.identity.done(function(identity) {
        view.find('.email').text(identity.email);
    });
    return view;
}

learnjs.showView = function(hash) {
    var routes = {
        '#problem': learnjs.problemView,
        '#profile': learnjs.profileView,
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
    learnjs.identity.done(learnjs.addProfileLink);
};

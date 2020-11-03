// Delete posts from a group wall, including by post content and by author name.
var rbx = require('roblox-js');
var ProgressBar = require('progress');
var prompt = require('prompt');
var stream = require('stream');
var crypto = require('crypto');
var fs = require('fs');
var js = require('JSONStream');
var transform = require('parallel-transform');

var mainPath;

var maxThreads = 10;

prompt.message = '';
var schema = {
  properties: {
    group: {
      description: 'Enter group ID',
      required: true,
      type: 'integer',
      message: 'Group ID must be an integer'
    },
    username: {
      description: 'Enter ROBLOX account username',
      required: true
    },
    password: {
      description: 'Enter ROBLOX account password',
      hidden: true,
      replace: '*',
      required: true
    },
    find: {
      description: 'Enter a string to find, this will only delete messages that have the specific string in them (optional)'
    },
    author: {
      description: 'Enter author username to find. This will only delete messages made by this player (optional)'
    },
    startPage: {
      description: 'Enter starting page (leave blank for all pages)',
      type: 'integer',
      message: 'Page must be an integer'
    },
    endPage: {
      description: 'Enter ending page',
      type: 'integer',
      message: 'Page must be an integer',
      ask: function () {
        return prompt.history('startPage').value > 0;
      }
    }
  }
};

function clean (path) {
  console.log('Cleaning up...');
  fs.unlinkSync(path);
}

function clearPage (group, page) {
  var jobs = [];
  var indices = page.indices;
  for (var i = 0; i < indices.length; i++) {
    var index = indices[i];
    jobs.push(rbx.deleteWallPost({
      group: group,
      post: {
        parent: {
          index: index
        },
        view: page.view
      }
    }));
  }
  return Promise.all(jobs);
}

function processPage (group, page, author, find) {
  var posts = page.posts;
  find = find.toLowerCase();
  var indices = [];
  for (var i = 0; i < posts.length; i++) {
    var post = posts[i];
    if ((!author && !find) || (author && post.author.name === author) || (find && post.content.toLowerCase().includes(find))) {
      indices.push(i);
    }
  }
  return {
    indices: indices,
    view: page.view
  };
}

function clear (group, path, total) {
  var deletePosts = new ProgressBar('Deleting posts [:bar] :current/:total = :percent :etas remaining ', {total: total});
  var complete = 0;

  function next () {
    console.timeEnd('Time: ');
  }

  var clearStream = transform(maxThreads, {objectMode: true}, function (chunk, done) {
    var len = chunk.indices.length;
    clearPage(group, chunk)
    .then(function () {
      deletePosts.tick(len);
      complete += len;
    })
    .catch(function (err) {
      console.error('Clear page error: ' + err.message);
    })
    .then(function () {
      done();
      if (complete >= total) {
        next();
      }
    });
  });
  clearStream.on('error', function (err) {
    console.error('Delete post stream error: ' + err.message);
  });

  var read = fs.createReadStream(path);
  var parse = js.parse('*');

  console.time('Time: ');

  read.pipe(parse).pipe(clearStream);
}

function get (group, find, author, startPage, endPage) {
  var pages;
  if (startPage && endPage) {
    pages = [];
    for (var i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
  }
  var wall = new ProgressBar('Getting wall [:bar] :current/:total = :percent :etas remaining ', {total: 10000, clear: true});

  var total = 0;
  var first, last;
  var low, high;

  var processStream = new stream.Transform({
    objectMode: true
  });
  processStream._transform = function (chunk, encoding, done) {
    if (startPage ? chunk.page === startPage : (!first || chunk.page < low)) {
      first = chunk.posts[0];
      low = chunk.page;
    } else if (endPage ? chunk.page === endPage : (!last || chunk.page > high)) {
      last = chunk.posts[chunk.posts.length - 1];
      high = chunk.page;
    }
    var response = processPage(group, chunk, author, find);
    var len = response.indices.length;
    total += len;
    var res = response;
    if (len === 0) {
      res = null;
    }
    done(null, res);
    chunk = null;
    response = null;
  };
  processStream.on('error', function (err) {
    console.error('Stream processing error: ' + err.message);
  });

  var path = './roblox-js-wall.' + crypto.randomBytes(10).toString('hex') + '.temp';
  mainPath = path;
  var write = fs.createWriteStream(path);
  var stringify = js.stringify('[\n', ',\n', '\n]\n');
  var pipeline = processStream.pipe(stringify).pipe(write);
  var promise = rbx.getWall({
    group: group,
    // page: pages,
    view: true
  });
  promise.then(function (wall) {
    var posts = wall.posts;
    // Remember these are reversed, it starts off with all the posts on the wall and you are REMOVING the ones you DON'T want to delete from the array
    /* for (var i = posts.length - 1; i >= 0; i--) {
      var post = posts[i];
      if (post.author.name !== 'Bob') { // Delete all posts by Bob
        posts.splice(i, 1);
      }
      if (!post.content.includes('Bob')) { // Delete all posts that contain "Bob"
        posts.splice(i, 1);
      }
    } */
    var deletion = new ProgressBar('Deleting posts [:bar] :current/:total = :percent :etas remaining ', {total: 10000});
    console.time('Time: ');
    var thread = rbx.threaded(function (i) {
      var post = posts[i];
      return rbx.deleteWallPost({
        group: group,
        post: {
          parent: {
            index: post.parent.index
          },
          view: wall.views[post.parent.page]
        }
      });
    }, 0, posts.length);
    var ivl = setInterval(function () {
      deletion.update(thread.getStatus() / 100);
    }, 1000);
    thread.then(function () {
      clearInterval(ivl);
      console.timeEnd('Time: ');
    });
  });
  var ivl = setInterval(function () {
    wall.update(promise.getStatus() / 100);
  }, 1000);
  promise.then(function () {
    clearInterval(ivl);
  });
  return new Promise(function (resolve, reject) {
    pipeline.on('finish', function () {
      resolve({
        path: path,
        total: total,
        first: first,
        last: last
      });
    });
  });
}

function init (group, username, password, find, author, startPage, endPage) {
  rbx.login(username, password)
  .then(function () {
    return get(group, find, author, startPage, endPage);
  })
  .then(function (response) {
    if (response.total === 0) {
      console.log('There are no wall posts to delete!');
      return;
    }
    console.log('You are about to delete ' + response.total + ' wall posts selected from ' + (startPage && endPage ? ('page ' + startPage + ' to ' + endPage) : ('ALL pages')));
    console.log('The list starts from the post "' + response.first.content.substring(0, 20) + '..." and ends with the post "' + response.last.content.substring(0, 20) + '..."');
    prompt.get({
      name: 'yesno',
      message: 'Are you sure you want to do this? y/n',
      validator: /^y|n$/,
      required: true,
      warning: 'You must respond with "y" or "n"'
    }, function (err, result) {
      if (err) {
        console.error('Prompt error: ' + err.message);
        return;
      }
      if (result.yesno === 'y') {
        clear(group, response.path, response.total);
      } else {
        console.log('Aborted');
        process.exit();
      }
    });
  });
}

prompt.start();
prompt.get(schema, function (err, result) {
  if (err) {
    console.error('Prompt error: ' + err.message);
    return;
  }
  init(result.group, result.username, result.password, result.find, result.author, result.startPage, result.endPage);
});

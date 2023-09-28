// Define a module called JsDiff
var JsDiff = (function () {
  // Helper function to clone a path object
  function clonePath(path) {
    return {
      newPos: path.newPos,
      components: path.components.slice(0),
    };
  }

  // Helper function to escape HTML special characters
  function escapeHTML(s) {
    var n = s;
    n = n.replace(/&/g, '&amp;');
    n = n.replace(/</g, '&lt;');
    n = n.replace(/>/g, '&gt;');
    n = n.replace(/"/g, '&quot;');

    return n;
  }

  // Define the constructor for Diff objects
  var Diff = function (ignoreWhitespace) {
    this.ignoreWhitespace = ignoreWhitespace;
  };

  // Define the prototype methods for Diff objects
  Diff.prototype = {
    diff: function (oldString, newString) {
      if (newString === oldString) {
        return [
          {
            value: newString,
          },
        ];
      }
      if (!newString) {
        return [
          {
            value: oldString,
            removed: true,
          },
        ];
      }
      if (!oldString) {
        return [
          {
            value: newString,
            added: true,
          },
        ];
      }

      newString = this.tokenize(newString);
      oldString = this.tokenize(oldString);

      var newLen = newString.length,
        oldLen = oldString.length;
      var maxEditLength = newLen + oldLen;
      var bestPath = [
        {
          newPos: -1,
          components: [],
        },
      ];

      var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0);
      if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
        return bestPath[0].components;
      }

      for (var editLength = 1; editLength <= maxEditLength; editLength++) {
        for (
          var diagonalPath = -1 * editLength;
          diagonalPath <= editLength;
          diagonalPath += 2
        ) {
          var basePath;
          var addPath = bestPath[diagonalPath - 1],
            removePath = bestPath[diagonalPath + 1];
          oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
          if (addPath) {
            bestPath[diagonalPath - 1] = undefined;
          }

          var canAdd = addPath && addPath.newPos + 1 < newLen;
          var canRemove = removePath && 0 <= oldPos && oldPos < oldLen;
          if (!canAdd && !canRemove) {
            bestPath[diagonalPath] = undefined;
            continue;
          }

          if (!canAdd || (canRemove && addPath.newPos < removePath.newPos)) {
            basePath = clonePath(removePath);
            this.pushComponent(
              basePath.components,
              oldString[oldPos],
              undefined,
              true
            );
          } else {
            basePath = clonePath(addPath);
            basePath.newPos++;
            this.pushComponent(
              basePath.components,
              newString[basePath.newPos],
              true,
              undefined
            );
          }

          var oldPos = this.extractCommon(
            basePath,
            newString,
            oldString,
            diagonalPath
          );

          if (basePath.newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
            return basePath.components;
          } else {
            bestPath[diagonalPath] = basePath;
          }
        }
      }
    },

    pushComponent: function (components, value, added, removed) {
      var last = components[components.length - 1];
      if (last && last.added === added && last.removed === removed) {
        components[components.length - 1] = {
          value: this.join(last.value, value),
          added: added,
          removed: removed,
        };
      } else {
        components.push({
          value: value,
          added: added,
          removed: removed,
        });
      }
    },
    extractCommon: function (basePath, newString, oldString, diagonalPath) {
      var newLen = newString.length,
        oldLen = oldString.length,
        newPos = basePath.newPos,
        oldPos = newPos - diagonalPath;
      while (
        newPos + 1 < newLen &&
        oldPos + 1 < oldLen &&
        this.equals(newString[newPos + 1], oldString[oldPos + 1])
      ) {
        newPos++;
        oldPos++;

        this.pushComponent(
          basePath.components,
          newString[newPos],
          undefined,
          undefined
        );
      }
      basePath.newPos = newPos;
      return oldPos;
    },

    equals: function (left, right) {
      var reWhitespace = /\S/;
      if (
        this.ignoreWhitespace &&
        !reWhitespace.test(left) &&
        !reWhitespace.test(right)
      ) {
        return true;
      } else {
        return left === right;
      }
    },
    join: function (left, right) {
      return left + right;
    },
    tokenize: function (value) {
      return value;
    },
  };

  // Create a LineDiff instance for line-based diff
  var LineDiff = new Diff();
  LineDiff.tokenize = function (value) {
    return value.split(/^/m);
  };

  // Expose the Diff constructor and some utility methods
  return {
    Diff: Diff,

    diffLines: function (oldStr, newStr) {
      return LineDiff.diff(oldStr, newStr);
    },

    createPatch: function (fileName, oldStr, newStr, oldHeader, newHeader) {
      var ret = [];

      ret.push('Index: ' + fileName);
      ret.push(
        '==================================================================='
      );
      ret.push(
        '--- ' +
          fileName +
          (typeof oldHeader === 'undefined' ? '' : '\t' + oldHeader)
      );
      ret.push(
        '+++ ' +
          fileName +
          (typeof newHeader === 'undefined' ? '' : '\t' + newHeader)
      );

      var diff = LineDiff.diff(oldStr, newStr);
      if (!diff[diff.length - 1].value) {
        diff.pop();
      }
      diff.push({
        value: '',
        lines: [],
      });

      function contextLines(lines) {
        return lines.map(function (entry) {
          return ' ' + entry;
        });
      }

      function eofNL(curRange, i, current) {
        var last = diff[diff.length - 2],
          isLast = i === diff.length - 2,
          isLastOfType =
            i === diff.length - 3 &&
            (current.added !== last.added || current.removed !== last.removed);

        if (!/\n$/.test(current.value) && (isLast || isLastOfType)) {
          curRange.push('\\ No newline at end of file');
        }
      }

      var oldRangeStart = 0,
        newRangeStart = 0,
        curRange = [],
        oldLine = 1,
        newLine = 1;
      for (var i = 0; i < diff.length; i++) {
        var current = diff[i],
          lines = current.lines || current.value.replace(/\n$/, '').split('\n');
        current.lines = lines;

        if (current.added || current.removed) {
          if (!oldRangeStart) {
            var prev = diff[i - 1];
            oldRangeStart = oldLine;
            newRangeStart = newLine;

            if (prev) {
              curRange = contextLines(prev.lines.slice(-4));
              oldRangeStart -= curRange.length;
              newRangeStart -= curRange.length;
            }
          }
          curRange.push.apply(
            curRange,
            lines.map(function (entry) {
              return (current.added ? '+' : '-') + entry;
            })
          );
          eofNL(curRange, i, current);

          if (current.added) {
            newLine += lines.length;
          } else {
            oldLine += lines.length;
          }
        } else {
          if (oldRangeStart) {
            if (lines.length <= 8 && i < diff.length - 2) {
              curRange.push.apply(curRange, contextLines(lines));
            } else {
              var contextSize = Math.min(lines.length, 4);
              ret.push(
                '@@ -' +
                  oldRangeStart +
                  ',' +
                  (oldLine - oldRangeStart + contextSize) +
                  ' +' +
                  newRangeStart +
                  ',' +
                  (newLine - newRangeStart + contextSize) +
                  ' @@'
              );
              ret.push.apply(ret, curRange);
              ret.push.apply(ret, contextLines(lines.slice(0, contextSize)));
              if (lines.length <= 4) {
                eofNL(ret, i, current);
              }

              oldRangeStart = 0;
              newRangeStart = 0;
              curRange = [];
            }
          }
          oldLine += lines.length;
          newLine += lines.length;
        }
      }

      return ret.join('\n') + '\n';
    },

    applyPatch: function (oldStr, uniDiff) {
      var diffstr = uniDiff.split('\n');
      var diff = [];
      var remEOFNL = false,
        addEOFNL = false;

      for (var i = diffstr[0][0] === 'I' ? 4 : 0; i < diffstr.length; i++) {
        if (diffstr[i][0] === '@') {
          var meh = diffstr[i].split(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
          diff.unshift({
            start: meh[3],
            oldlength: meh[2],
            oldlines: [],
            newlength: meh[4],
            newlines: [],
          });
        } else if (diffstr[i][0] === '+') {
          diff[0].newlines.push(diffstr[i].substr(1));
        } else if (diffstr[i][0] === '-') {
          diff[0].oldlines.push(diffstr[i].substr(1));
        } else if (diffstr[i][0] === ' ') {
          diff[0].newlines.push(diffstr[i].substr(1));
          diff[0].oldlines.push(diffstr[i].substr(1));
        } else if (diffstr[i][0] === '\\') {
          if (diffstr[i - 1][0] === '+') {
            remEOFNL = true;
          } else if (diffstr[i - 1][0] === '-') {
            addEOFNL = true;
          }
        }
      }

      var str = oldStr.split('\n');
      for (var i = diff.length - 1; i >= 0; i--) {
        var d = diff[i];
        for (var j = 0; j < d.oldlength; j++) {
          if (str[d.start - 1 + j] !== d.oldlines[j]) {
            return false;
          }
        }
        Array.prototype.splice.apply(
          str,
          [d.start - 1, +d.oldlength].concat(d.newlines)
        );
      }

      if (remEOFNL) {
        while (!str[str.length - 1]) {
          str.pop();
        }
      } else if (addEOFNL) {
        str.push('');
      }
      return str.join('\n');
    },

    convertChangesToXML: function (changes) {
      var ret = [];
      for (var i = 0; i < changes.length; i++) {
        var change = changes[i];
        if (change.added) {
          ret.push("<ins class='diff'>");
        } else if (change.removed) {
          ret.push("<del class='diff'>");
        }

        ret.push(escapeHTML(change.value));

        if (change.added) {
          ret.push('</ins>');
        } else if (change.removed) {
          ret.push('</del>');
        }
      }
      return ret.join('');
    },

    convertChangesToDMP: function (changes) {
      var ret = [],
        change;
      for (var i = 0; i < changes.length; i++) {
        change = changes[i];
        ret.push([change.added ? 1 : change.removed ? -1 : 0, change.value]);
      }
      return ret;
    },
  };
})();

// Define the diffType and reference the HTML elements
var diffType = 'diffLines';
var jsonA = document.getElementById('jsonA');
var jsonB = document.getElementById('jsonB');
var jsonResult = document.getElementById('jsonResult');
var solrA = document.getElementById('solrA');
var solrB = document.getElementById('solrB');
var solrResult = document.getElementById('solrResult');
var diffType = 'diffLines';

// Define the function to check JSON differences
function checkJSON() {
  var oldStr = jsonA.value;
  var newStr = jsonB.value;
  var changes = JsDiff[diffType](oldStr, newStr);
  jsonResult.innerHTML = JsDiff.convertChangesToXML(changes);
}

// Define the function to check Solr differences
function checkSolr() {
  var oldStr = solrA.value;
  var newStr = solrB.value;
  var changes = JsDiff[diffType](oldStr, newStr);
  solrResult.innerHTML = JsDiff.convertChangesToXML(changes);
}

// Set event listeners to trigger the check functions on user input
jsonA.onkeyup =
  jsonB.onkeyup =
  jsonA.onpaste =
  jsonA.onchange =
  jsonB.onpaste =
  jsonB.onchange =
    checkJSON;
solrA.onkeyup =
  solrB.onkeyup =
  solrA.onpaste =
  solrA.onchange =
  solrB.onpaste =
  solrB.onchange =
    checkSolr;

// Perform the initial checks
checkJSON();
checkSolr();

// Set event listeners to change diffType on radio button change
var radio = document.getElementsByName('diff_type');
for (var i = 0; i < radio.length; i++) {
  radio[i].onchange = function (e) {
    diffType = this.value;
    checkJSON();
    checkSolr();
  };
}

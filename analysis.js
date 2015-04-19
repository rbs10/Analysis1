// Parse data and return a completed analysis of the data

// analysis
//   firstRowChanges = 0 based index of the first row of changes
//   lastRowChanges = 0 based index of the last row of changes
//   bells - string each bell
//   blows
//     blow
//       isHandstroke - true/false
//       positionInRow - 0,1,2,3 ...
//       timeInRow - time relative to first blow in row
//       bell, - name of bell in touch 1234567890ET
//       bellCount - number of times bell has appeared
//       lineNumber - line number in file
//       rawData - raw data for this blow
//       ms - time in touch
//       gap - ms since previous bell
//       adjustedTime = time relative to ideal start of row
//       idealPosition = ideal position in absolute time
//       adjustedIdealPosition = ideal position relative to ideal start of row
//       (quick fudge to scale adjustedTime to constant gap of 200 so that could quickly plot multiple touches together)
//   rows
//     row
//       isHandstroke
//       blows
//         blow (see above)
//   wholePulls
//     wholePull
//       midpoint (mean bell position)
//       duration (first to last strike)
//       idealStart = ideal position of first bell
//       targetSpacing = ideal spacing of bells in row
//       blows
//         blow (see above)

function getAnalysis(dataString, normaliseSpacing) {
	var analysis = getBasicAnalysis(dataString);
	assignRowPositions(analysis);
	assignAdjustedTimes(analysis);
	rodIt(analysis, normaliseSpacing);
	analysis.firstRowChanges = findStartOfChanges(analysis);
	analysis.lastRowChanges = findEndOfChanges(analysis);
	return analysis;
}

// Find zero based index of first row that looks like changes
function findStartOfChanges(analysis) {
	// expect to get some rounds maybe with errors then something very not rounds like to start
	// finish multiple rounds maybe with errors at end
	for (var row = 0; row < analysis.rows.length; ++row) {
		if (bellsInPlaceRounds(analysis.rows[row], analysis.bells) < analysis.bells.length -4 ) {
			return row;
		}
	}
}

// Find zero based index of first row that looks like changes
function findEndOfChanges(analysis) {
	// expect to get some rounds maybe with errors then something very not rounds like to start
	// finish multiple rounds maybe with errors at end
	for (var row = analysis.rows.length-1; row > 0; --row) {
		if (bellsInPlaceRounds(analysis.rows[row], analysis.bells) < analysis.bells.length -4 ) {
			return row;
		}
	}
}

// Return true if row is rounds on the specified set of bells
function isRounds(row, bells) {

	for (var pos = 0; pos < row.blows.length; ++pos) {
		if (row.blows[pos].bell != bells[pos]) {
			return false;
		}
	}
	return true;
}

// Return true if row is rounds on the specified set of bells
function bellsInPlaceRounds(row, bells) {

    var ret = 0;
	for (var pos = 0; pos < row.blows.length; ++pos) {
		if (row.blows[pos].bell == bells[pos]) {
		++ret;
		}
	}
	return ret;
}

// Assign blow.offset as aveHand - aveGen at the start of each row
function assignAdjustedTimes(analysis) {
	var nBells = analysis.bells.length;
	var rows = analysis.blows.length / nBells;
	var isHandstroke = true;
	var blowNo = 0;
	var handstokeGapTotal = 0;
	var handstrokeGapCount = 0;
	var generalGapTotal = 0;
	var generalGapCount = 0;
	for (var row = 0; row < rows; ++row) {
		var offset = 0;
		for (var posInRow = 1; posInRow <= nBells; ++posInRow) {
			if (blowNo < analysis.blows.length) {
				// ignore the first row where we do not have a handstroke gap
				if (row > 2) {
					var blow = analysis.blows[blowNo];
					if (blow.isHandstroke && blow.positionInRow == 1) {
						handstokeGapTotal += blow.gap;
						++handstrokeGapCount;

						var aveHand = handstokeGapTotal / handstrokeGapCount;
						var aveGen = generalGapTotal / generalGapCount;
						offset = aveHand - aveGen;
						blow.adjustedGap = blow.gap - offset;
					} else {
						generalGapTotal += blow.gap;
						++generalGapCount;
						blow.adjustedGap = blow.gap;
					}
					blow.offset = offset;
				}++blowNo;
			}
			isHandstroke = !isHandstroke;
		}
	}
}

// ideal position of bells is calculated relative to the mid point of the change
// spacing is 1/(2N+1) of the inter-wholePull gap
//
// wholePull.midpoint (mean bell position)
// whollePull.duration (first to last strike)
// wholePull.idealStart = ideal position of first bell
// wholePull.targetSpacing = ideal spacing of bells in row

// adjustedTime = time relative to ideal start of row
// idealPosition = ideal position in absolute time
// adjustedIdealPosition = ideal position relative to ideal start of row
// (quick fudge to scale adjustedTime to constant gap of 200 so that could quickly plot multiple touches together)

function rodIt(analysis,normaliseSpacing) {
	for (var wp = 0; wp < analysis.wholePulls.length; ++wp) {
		var wholePull = analysis.wholePulls[wp];
		var totalMs = 0.0;
		wholePull.blows.forEach(function(blow) {
			totalMs += blow.ms;
		})
		wholePull.midpoint = totalMs / wholePull.blows.length;

		wholePull.duration = wholePull.blows[wholePull.blows.length - 1].ms - wholePull.blows[0].ms;

		// if got previous rows then target spacing from previous rows
		var targetSpacing;
		if (wp == 0) {
			targetSpacing = wholePull.duration / (wholePull.blows.length - 1);
		} else {
			targetSpacing = (wholePull.midpoint - analysis.wholePulls[wp - 1].midpoint) / (wholePull.blows.length + 1);
		}

		wholePull.idealStart = wholePull.midpoint - ((wholePull.blows.length / 2) - 0.5) * targetSpacing;
		wholePull.targetSpacing = targetSpacing;

		if (wholePull.rows.length > 0) {
			for (var i = 0; i < wholePull.rows[0].blows.length; ++i) {
				wholePull.rows[0].blows[i].adjustedTime = wholePull.rows[0].blows[i].ms - wholePull.idealStart;
				wholePull.rows[0].blows[i].idealPosition = wholePull.idealStart + i * targetSpacing;
				wholePull.rows[0].blows[i].adjustedIdealPosition = wholePull.rows[0].blows[i].idealPosition - wholePull.idealStart;
			}
		}
		if (wholePull.rows.length > 1) {
			for (var i = 0; i < wholePull.rows[1].blows.length; ++i) {
				wholePull.rows[1].blows[i].adjustedTime = wholePull.rows[1].blows[i].ms - wholePull.idealStart - wholePull.rows[0].blows.length * targetSpacing;
				wholePull.rows[1].blows[i].idealPosition = wholePull.idealStart + (i + wholePull.rows[0].blows.length) * targetSpacing;
				wholePull.rows[1].blows[i].adjustedIdealPosition = wholePull.rows[1].blows[i].idealPosition - wholePull.idealStart - wholePull.rows[0].blows.length * targetSpacing;
			}
		}

		if (normaliseSpacing) {
			// quick fudge to normalise spacing
			for (var i = 0; i < wholePull.blows.length; ++i) {
				var f = 200 / wholePull.targetSpacing;
				wholePull.blows[i].adjustedTime *= f;
				wholePull.blows[i].idealPosition *= f;
				wholePull.blows[i].adjustedIdealPosition *= f;
				wholePull.blows[i].adjustedGap *= f;
			}
		}
	}
}

// Phase 2 of analysis
// blow.isHandstroke = isHandstroke;
// blow.positionInRow
// blow.timeInRow - simple time from start
function assignRowPositions(analysis) {
	var nBells = analysis.bells.length;
	var nRows = analysis.blows.length / nBells;
	var isHandstroke = true;
	var blowNo = 0;

	var wholePulls = new Array();
	var rows = new Array();

	analysis.wholePulls = wholePulls;
	analysis.rows = rows;

	var wholePull;
	var row;
	var timeInRow = 0;
	var positionInRow = 0;
	var isHandstroke = false;

	for (var blowNo = 0; blowNo < nRows * nBells; ++blowNo) {

		if (blowNo % (2 * nBells) == 0) {

			wholePull = new Object();
			wholePull.blows = new Array();
			wholePulls.push(wholePull);
			wholePull.rows = new Array();
		}
		if (blowNo % nBells == 0) {
			row = new Object();
			row.blows = new Array();
			timeInRow = 0;
			positionInRow = 0;
			isHandstroke = !isHandstroke;
			rows.push(row);
			wholePull.rows.push(row);
		}
		var blow = analysis.blows[blowNo];
		timeInRow += blow.gap; ++positionInRow;
		blow.isHandstroke = isHandstroke;
		blow.positionInRow = positionInRow;
		blow.timeInRow = timeInRow;

		row.blows.push(blow);
		row.isHandstroke = blow.isHandstroke;
		wholePull.blows.push(blow);
	};

}

// Return analysis of single file in local storage
function getAnalysisFromLocalStorage() {
	var dataString = localStorage.data;
	return getBasicAnalysis(dataString);
}

// Do basic file reading and work out individual gaps
function getBasicAnalysis(dataString) {
	var lines = dataString.match(/^.*((\r\n|\n|\r)|$)/gm);
	var blows = new Array();
	var lastTime = 0;
	var overruns = 0;
	var bellCounts = new Array();
	var nBells = 0;
	var bells = new Array();

	for (var i = 0; i < lines.length; ++i) {
		// lines are like H 2 0X00dc
		var bits = lines[i].split(" ");

		if (bits.length == 3) {
			if (bits[0] == "H" || bits[0] == "B") {

				var rawTime = parseInt(bits[2].trim()) + overruns;
				if (rawTime < lastTime) {
					rawTime += 65536;
					overruns += 65536;
				}
				var gap = rawTime - lastTime;
				lastTime = rawTime;

				var bell = bits[1];
				if (isNaN(bellCounts[bell])) {
					bellCounts[bell] = 0;
					++nBells;
					bells.push(bell);
				} else {
					bellCounts[bell]++;
				}

				blows.push({
					bell : bell,
					bellCount : bellCounts[bell],
					gap : gap,
					lineNumber : i + 1,
					rawData : lines[i],
					ms : lastTime
				});

			}
		}
	}

	var analysis = {
		bellCounts : bellCounts,
		blows : blows,
		bells : bells
	};

	return analysis;
};

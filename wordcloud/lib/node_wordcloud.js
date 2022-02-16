/*!
 * wordcloud2.js
 * http://timdream.org/wordcloud2.js/
 *
 * Copyright 2011 - 2019 Tim Guan-tin Chien and contributors.
 * Released under the MIT license
 */

'use strict'

const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

(function(global) {
    var isSupported = true
    var minFontSize = 0
    var getItemExtraData = function(item) {
        if (Array.isArray(item)) {
            var itemCopy = item.slice()
            // remove data we already have (word and weight)
            itemCopy.splice(0, 2)
            return itemCopy
        } else {
            return []
        }
    }

    // Based on http://jsfromhell.com/array/shuffle
    var shuffleArray = function shuffleArray(arr) {
        for (var j, x, i = arr.length; i;) {
            j = Math.floor(Math.random() * i)
            x = arr[--i]
            arr[i] = arr[j]
            arr[j] = x
        }
        return arr
    }

    var timer = {};
    var WordCloud = function WordCloud(elements, options, newCanvas) {
        return new Promise((resolve, reject) => {

            var timerId = Math.floor(Math.random() * Date.now())

            // 初始配置信息
            /* Default values to be overwritten by options object */
            var settings = {
                list: [],
                fontFamily: '"Trebuchet MS", "Heiti TC", "微软雅黑", "微軟正黑體", ' +
                    '"Arial Unicode MS", "Droid Fallback Sans", sans-serif',
                fontWeight: 'normal',
                color: 'random-dark',
                minSize: 0, // 0 to disable
                weightFactor: 1,
                clearCanvas: true,
                backgroundColor: '#fff', // opaque white = rgba(255, 255, 255, 1)

                gridSize: 8,
                drawOutOfBound: false,
                shrinkToFit: false,
                origin: null,

                drawMask: false,
                maskColor: 'rgba(255,255,0,0.3)',
                maskGapWidth: 0.3,

                wait: 0,
                abortThreshold: 0, // disabled
                abort: function noop() {},

                minRotation: -Math.PI / 2,
                maxRotation: Math.PI / 2,
                rotationSteps: 0,

                shuffle: true,
                rotateRatio: 0.1,

                shape: 'circle',
                ellipticity: 0.65,

                classes: null,

                hover: null,
                click: null
            }

            // 传入配置替换初始配置
            if (options) {
                for (var key in options) {
                    if (key in settings) {
                        settings[key] = options[key]
                    }
                }
            }

            // 将权重系数转为方法
            /* Convert weightFactor into a function */
            if (typeof settings.weightFactor !== 'function') {
                var factor = settings.weightFactor
                settings.weightFactor = function weightFactor(pt) {
                    return pt * factor // in px
                }
            }

            // 将形状转为方法
            /* Convert shape into a function */
            if (typeof settings.shape !== 'function') {
                switch (settings.shape) {
                    case 'circle':
                        /* falls through */
                    default:
                        // 'circle' is the default and a shortcut in the code loop.
                        settings.shape = 'circle'
                        break

                    case 'cardioid':
                        settings.shape = function shapeCardioid(theta) {
                            return 1 - Math.sin(theta)
                        }
                        break
                    case 'diamond':
                        settings.shape = function shapeSquare(theta) {
                            var thetaPrime = theta % (2 * Math.PI / 4)
                            return 1 / (Math.cos(thetaPrime) + Math.sin(thetaPrime))
                        }
                        break
                    case 'square':
                        settings.shape = function shapeSquare(theta) {
                            return Math.min(
                                1 / Math.abs(Math.cos(theta)),
                                1 / Math.abs(Math.sin(theta))
                            )
                        }
                        break
                    case 'triangle-forward':
                        settings.shape = function shapeTriangle(theta) {
                            var thetaPrime = theta % (2 * Math.PI / 3)
                            return 1 / (Math.cos(thetaPrime) +
                                Math.sqrt(3) * Math.sin(thetaPrime))
                        }
                        break
                    case 'triangle':
                    case 'triangle-upright':
                        settings.shape = function shapeTriangle(theta) {
                            var thetaPrime = (theta + Math.PI * 3 / 2) % (2 * Math.PI / 3)
                            return 1 / (Math.cos(thetaPrime) +
                                Math.sqrt(3) * Math.sin(thetaPrime))
                        }
                        break
                    case 'pentagon':
                        settings.shape = function shapePentagon(theta) {
                            var thetaPrime = (theta + 0.955) % (2 * Math.PI / 5)
                            return 1 / (Math.cos(thetaPrime) +
                                0.726543 * Math.sin(thetaPrime))
                        }
                        break
                    case 'star':
                        settings.shape = function shapeStar(theta) {
                            var thetaPrime = (theta + 0.955) % (2 * Math.PI / 10)
                            if ((theta + 0.955) % (2 * Math.PI / 5) - (2 * Math.PI / 10) >= 0) {
                                return 1 / (Math.cos((2 * Math.PI / 10) - thetaPrime) +
                                    3.07768 * Math.sin((2 * Math.PI / 10) - thetaPrime))
                            } else {
                                return 1 / (Math.cos(thetaPrime) +
                                    3.07768 * Math.sin(thetaPrime))
                            }
                        }
                        break
                }
            }

            // 确保 gridSize 是一个整数并且不小于 4px
            /* Make sure gridSize is a whole number and is not smaller than 4px */
            settings.gridSize = Math.max(Math.floor(settings.gridSize), 4)

            // 转换值
            /* shorthand */
            var g = settings.gridSize
            var maskRectWidth = g - settings.maskGapWidth

            // 标准化旋转设置
            /* normalize rotation settings */
            var rotationRange = Math.abs(settings.maxRotation - settings.minRotation)
            var rotationSteps = Math.abs(Math.floor(settings.rotationSteps))
            var minRotation = Math.min(settings.maxRotation, settings.minRotation)

            // 所有函数都可用的信息/对象，在 start() 时设置
            /* information/object available to all functions, set when start() */
            var grid, // 2d array containing filling information
                ngx, // width and height of the grid
                ngy,
                center, // position of the center of the cloud
                maxRadius

            // 用于测量每个 putWord() 操作的时间戳
            /* timestamp for measuring each putWord() action */
            var escapeTime

            // 获取文本颜色的函数
            /* function for getting the color of the text */
            var getTextColor

            // 随机颜色
            function randomHslColor(min, max) {
                return 'hsl(' +
                    (Math.random() * 360).toFixed() + ',' +
                    (Math.random() * 30 + 70).toFixed() + '%,' +
                    (Math.random() * (max - min) + min).toFixed() + '%)'
            }
            switch (settings.color) {
                case 'random-dark':
                    getTextColor = function getRandomDarkColor() {
                        return randomHslColor(10, 50)
                    }
                    break
                case 'random-light':
                    getTextColor = function getRandomLightColor() {
                        return randomHslColor(50, 90)
                    }
                    break
                default:
                    if (typeof settings.color === 'function') {
                        getTextColor = settings.color
                    }
                    break
            }

            // 获取文本字体粗细
            /* function for getting the font-weight of the text */
            var getTextFontWeight
            if (typeof settings.fontWeight === 'function') {
                getTextFontWeight = settings.fontWeight
            }

            // 交互性设置[无效]
            /* Interactive */
            var interactive = false
            var infoGrid = []
            var hovered

            // 获取网格上距中心给定半径的点
            /* Get points on the grid for a given radius away from the center */
            var pointsAtRadius = []
            var getPointsAtRadius = function getPointsAtRadius(radius) {
                if (pointsAtRadius[radius]) {
                    return pointsAtRadius[radius]
                }

                // Look for these number of points on each radius
                var T = radius * 8

                // Getting all the points at this radius
                var t = T
                var points = []

                if (radius === 0) {
                    points.push([center[0], center[1], 0])
                }

                while (t--) {
                    // distort the radius to put the cloud in shape
                    var rx = 1
                    if (settings.shape !== 'circle') {
                        rx = settings.shape(t / T * 2 * Math.PI) // 0 to 1
                    }

                    // Push [x, y, t] t is used solely for getTextColor()
                    points.push([
                        center[0] + radius * rx * Math.cos(-t / T * 2 * Math.PI),
                        center[1] + radius * rx * Math.sin(-t / T * 2 * Math.PI) *
                        settings.ellipticity,
                        t / T * 2 * Math.PI
                    ])
                }

                pointsAtRadius[radius] = points
                return points
            }

            // 如果花费时间过多则返回true
            /* Return true if we had spent too much time */
            var exceedTime = function exceedTime() {
                return ((settings.abortThreshold > 0) &&
                    ((new Date()).getTime() - escapeTime > settings.abortThreshold))
            }

            // 根据设置获取旋转度数和 运气?
            /* Get the deg of rotation according to settings, and luck. */
            var getRotateDeg = function getRotateDeg() {
                if (settings.rotateRatio === 0) {
                    return 0
                }

                if (Math.random() > settings.rotateRatio) {
                    return 0
                }

                if (rotationRange === 0) {
                    return minRotation
                }

                if (rotationSteps > 0) {
                    // 最小旋转 + 零个或多个步骤 * 一个步骤的跨度
                    // Min rotation + zero or more steps * span of one step
                    return minRotation +
                        Math.floor(Math.random() * rotationSteps) *
                        rotationRange / (rotationSteps - 1)
                } else {
                    return minRotation + Math.random() * rotationRange
                }
            }

            var getTextInfo = function getTextInfo(word, weight, rotateDeg, extraDataArray) {
                // 计算实际字体大小
                // fontSize === 0 表示 weightFactor 函数想要跳过文本，
                // 而 size < minSize 意味着我们无法绘制文本。
                var debug = false
                var fontSize = settings.weightFactor(weight)
                if (fontSize <= settings.minSize) {
                    return false
                }
                // 这里的比例是为了确保 fillText 不受限制
                // 浏览器设置的最小字体大小。
                // 它总是 1 或 2n。
                var mu = 1
                if (fontSize < minFontSize) {
                    mu = (function calculateScaleFactor() {
                        var mu = 2
                        while (mu * fontSize < minFontSize) {
                            mu += 2
                        }
                        return mu
                    })()
                }

                // 获取将用于设置 fctx.font 的 fontWeight
                // Get fontWeight that will be used to set fctx.font
                var fontWeight
                if (getTextFontWeight) {
                    fontWeight = getTextFontWeight(word, weight, fontSize, extraDataArray)
                } else {
                    fontWeight = settings.fontWeight
                }

                // var fcanvas = document.createElement('canvas')
                var fcanvas = newCanvas()
                var fctx = fcanvas.getContext('2d', { willReadFrequently: true })

                fctx.font = fontWeight + ' ' +
                    (fontSize * mu).toString(10) + 'px ' + settings.fontFamily

                // 使用 measureText() 估计文本的维度。
                // Estimate the dimension of the text with measureText().
                var fw = fctx.measureText(word).width / mu
                var fh = Math.max(fontSize * mu,
                    fctx.measureText('m').width,
                    fctx.measureText('\uFF37').width
                ) / mu

                // 创建一个大于我们估计的边界框，
                // 所以文本不会被剪掉（还是有可能）
                // Create a boundary box that is larger than our estimates,
                // so text don't get cut of (it sill might)
                var boxWidth = fw + fh * 2
                var boxHeight = fh * 3
                var fgw = Math.ceil(boxWidth / g)
                var fgh = Math.ceil(boxHeight / g)
                boxWidth = fgw * g
                boxHeight = fgh * g

                // 计算适当的偏移量以使文本居中
                // 首选位置。
                // Calculate the proper offsets to make the text centered at
                // the preferred position.

                // 这是宽度的一半。
                // This is simply half of the width.
                var fillTextOffsetX = -fw / 2
                // 而不是将框移动到首选的正中间位置，
                // 对于 Y 偏移，我们移动 0.4，所以拉丁字母看起来垂直居中。
                var fillTextOffsetY = -fh * 0.4

                // 计算画布的实际尺寸，考虑旋转。
                // Calculate the actual dimension of the canvas, considering the rotation.
                var cgh = Math.ceil((boxWidth * Math.abs(Math.sin(rotateDeg)) +
                    boxHeight * Math.abs(Math.cos(rotateDeg))) / g)
                var cgw = Math.ceil((boxWidth * Math.abs(Math.cos(rotateDeg)) +
                    boxHeight * Math.abs(Math.sin(rotateDeg))) / g)
                var width = cgw * g
                var height = cgh * g

                fcanvas.width = width
                fcanvas.height = height

                if (debug) {
                    // 保存它的状态，以便我们可以正确地恢复和绘制网格。
                    // Save it's state so that we could restore and draw the grid correctly.
                    fctx.save()
                }

                // 用 |mu| 缩放画布。
                // Scale the canvas with |mu|.
                fctx.scale(1 / mu, 1 / mu)
                fctx.translate(width * mu / 2, height * mu / 2)
                fctx.rotate(-rotateDeg)

                // 一旦设置了宽度/高度，ctx 信息将被重置。
                // 在这里再次设置。
                // Once the width/height is set, ctx info will be reset.
                // Set it again here.
                fctx.font = fontWeight + ' ' +
                    (fontSize * mu).toString(10) + 'px ' + settings.fontFamily

                // 将文本填充到 fcanvas 中。
                fctx.fillStyle = '#000'
                fctx.textBaseline = 'middle'
                fctx.fillText(
                    word, fillTextOffsetX * mu,
                    (fillTextOffsetY + fontSize * 0.5) * mu
                )

                // 获取文本的像素
                // Get the pixels of the text
                var imageData = fctx.getImageData(0, 0, width, height).data

                // 如果使用了太长的时间 则返回false
                if (exceedTime()) {
                    return false
                }

                if (debug) {
                    // 绘制初始估计的框
                    // Draw the box of the original estimation
                    fctx.strokeRect(
                        fillTextOffsetX * mu,
                        fillTextOffsetY, fw * mu, fh * mu
                    )
                    fctx.restore()
                }

                // 读取像素并将信息保存到占用数组中
                // Read the pixels and save the information to the occupied array
                var occupied = []
                var gx = cgw
                var gy, x, y
                var bounds = [cgh / 2, cgw / 2, cgh / 2, cgw / 2]
                while (gx--) {
                    gy = cgh
                    while (gy--) {
                        y = g
                        /* eslint 无标签: ["error", { "allowLoop": true }] */
                        /* eslint no-labels: ["error", { "allowLoop": true }] */
                        singleGridLoop: while (y--) {
                            x = g
                            while (x--) {
                                if (imageData[((gy * g + y) * width +
                                        (gx * g + x)) * 4 + 3]) {
                                    occupied.push([gx, gy])

                                    if (gx < bounds[3]) {
                                        bounds[3] = gx
                                    }
                                    if (gx > bounds[1]) {
                                        bounds[1] = gx
                                    }
                                    if (gy < bounds[0]) {
                                        bounds[0] = gy
                                    }
                                    if (gy > bounds[2]) {
                                        bounds[2] = gy
                                    }

                                    if (debug) {
                                        fctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
                                        fctx.fillRect(gx * g, gy * g, g - 0.5, g - 0.5)
                                    }
                                    break singleGridLoop
                                }
                            }
                        }
                        if (debug) {
                            fctx.fillStyle = 'rgba(0, 0, 255, 0.5)'
                            fctx.fillRect(gx * g, gy * g, g - 0.5, g - 0.5)
                        }
                    }
                }

                if (debug) {
                    fctx.fillStyle = 'rgba(0, 255, 0, 0.5)'
                    fctx.fillRect(
                        bounds[3] * g,
                        bounds[0] * g,
                        (bounds[1] - bounds[3] + 1) * g,
                        (bounds[2] - bounds[0] + 1) * g
                    )
                }

                // 返回在真实画布上创建文本所需的信息
                // Return information needed to create the text on the real canvas
                let info = {
                    mu: mu,
                    occupied: occupied,
                    bounds: bounds,
                    gw: cgw,
                    gh: cgh,
                    fillTextOffsetX: fillTextOffsetX,
                    fillTextOffsetY: fillTextOffsetY,
                    fillTextWidth: fw,
                    fillTextHeight: fh,
                    fontSize: fontSize
                }
                return info
            }

            /* 确定给定维度内是否有可用空间 */
            /* Determine if there is room available in the given dimension */
            var canFitText = function canFitText(gx, gy, gw, gh, occupied) {
                // 遍历占据的点，
                // 如果空间不可用，则返回 false。
                // Go through the occupied points,
                // return false if the space is not available.
                var i = occupied.length
                while (i--) {
                    var px = gx + occupied[i][0]
                    var py = gy + occupied[i][1]

                    if (px >= ngx || py >= ngy || px < 0 || py < 0) {
                        if (!settings.drawOutOfBound) {
                            return false
                        }
                        continue
                    }

                    if (!grid[px][py]) {
                        return false
                    }
                }
                // console.log("文本能够放下")
                return true
            }

            /* 实际上是在网格上绘制文本 */
            /* Actually draw the text on the grid */
            var drawText = function drawText(gx, gy, info, word, weight, distance, theta, rotateDeg, attributes, extraDataArray) {
                var fontSize = info.fontSize
                var color
                if (getTextColor) {
                    color = getTextColor(word, weight, fontSize, distance, theta, extraDataArray)
                } else {
                    color = settings.color
                }

                // 获取将用于设置 ctx.font 和字体样式规则的 fontWeight
                // get fontWeight that will be used to set ctx.font and font style rule
                var fontWeight
                if (getTextFontWeight) {
                    fontWeight = getTextFontWeight(word, weight, fontSize, extraDataArray)
                } else {
                    fontWeight = settings.fontWeight
                }

                // var classes
                // if (getTextClasses) {
                //     classes = getTextClasses(word, weight, fontSize, extraDataArray)
                // } else {
                //     classes = settings.classes
                // }
                var ctx = elements.getContext('2d')
                var mu = info.mu

                // console.log("绘制文本", { fontSize, color, fontWeight, classes, elements, ctx, mu })
                // 在弄乱它之前保存当前状态
                // Save the current state before messing it
                ctx.save()
                ctx.scale(1 / mu, 1 / mu)
                ctx.font = fontWeight + ' ' + (fontSize * mu).toString(10) + 'px ' + settings.fontFamily
                ctx.fillStyle = color
                // 将画布位置平移到 where 的原点坐标
                // 应该放置文本。
                // Translate the canvas position to the origin coordinate of where
                // the text should be put.
                ctx.translate(
                    (gx + info.gw / 2) * g * mu,
                    (gy + info.gh / 2) * g * mu
                )
                if (rotateDeg !== 0) {
                    ctx.rotate(-rotateDeg)
                }
                // 最后，填充文本。
                // Finally, fill the text.
                ctx.textBaseline = 'middle'
                ctx.fillText(
                    word, info.fillTextOffsetX * mu,
                    (info.fillTextOffsetY + fontSize * 0.5) * mu
                )
                // 恢复状态。
                // Restore the state.
                ctx.restore()
            }

            /* 更新网格的帮助函数 */
            /* Help function to updateGrid */
            var fillGridAt = function fillGridAt(x, y, drawMask, dimension, item) {
                if (x >= ngx || y >= ngy || x < 0 || y < 0) {
                    return
                }
                grid[x][y] = false
                if (drawMask) {
                    var ctx = elements.getContext('2d')
                    ctx.fillRect(x * g, y * g, maskRectWidth, maskRectWidth)
                }
                if (interactive) {
                    infoGrid[x][y] = { item: item, dimension: dimension }
                }
            }

            /* 用占用点更新给定空间的填充信息。如有必要，在画布上绘制蒙版。 */
            var updateGrid = function updateGrid(gx, gy, gw, gh, info, item) {
                var occupied = info.occupied
                var drawMask = settings.drawMask
                var ctx
                if (drawMask) {
                    ctx = elements.getContext('2d')
                    ctx.save()
                    ctx.fillStyle = settings.maskColor
                }

                var dimension
                if (interactive) {
                    var bounds = info.bounds
                    dimension = {
                        x: (gx + bounds[3]) * g,
                        y: (gy + bounds[0]) * g,
                        w: (bounds[1] - bounds[3] + 1) * g,
                        h: (bounds[2] - bounds[0] + 1) * g
                    }
                }

                var i = occupied.length
                while (i--) {
                    var px = gx + occupied[i][0]
                    var py = gy + occupied[i][1]

                    if (px >= ngx || py >= ngy || px < 0 || py < 0) {
                        continue
                    }

                    fillGridAt(px, py, drawMask, dimension, item)
                }

                if (drawMask) {
                    ctx.restore()
                }
            }

            /* putWord() 处理列表中的每一项，计算它的大小并确定它的位置，然后将它放到画布上。 */
            var putWord = function putWord(item) {
                var word, weight, attributes
                if (Array.isArray(item)) {
                    word = item[0]
                    weight = item[1]
                } else {
                    word = item.word
                    weight = item.weight
                    attributes = item.attributes
                }
                var rotateDeg = getRotateDeg()

                var extraDataArray = getItemExtraData(item)

                // get info needed to put the text onto the canvas
                var info = getTextInfo(word, weight, rotateDeg, extraDataArray)

                // not getting the info means we shouldn't be drawing this one.
                if (!info) {
                    return false
                }

                if (exceedTime()) {
                    return false
                }

                // 如果 drawOutOfBound 设置为 false，如果我们已经知道 word 的边界框大于画布，则跳过循环。
                // If drawOutOfBound is set to false,
                // skip the loop if we have already know the bounding box of
                // word is larger than the canvas.
                if (!settings.drawOutOfBound && !settings.shrinkToFit) {
                    var bounds = info.bounds;
                    if ((bounds[1] - bounds[3] + 1) > ngx ||
                        (bounds[2] - bounds[0] + 1) > ngy) {
                        return false
                    }
                }

                // 通过开始寻找最近的点来确定放置文本的位置
                // Determine the position to put the text by
                // start looking for the nearest points
                var r = maxRadius + 1

                var tryToPutWordAtPoint = function(gxy) {
                    var gx = Math.floor(gxy[0] - info.gw / 2)
                    var gy = Math.floor(gxy[1] - info.gh / 2)
                    var gw = info.gw
                    var gh = info.gh

                    // 如果我们不能在这个位置适合文本，则返回 false 并转到下一个位置。
                    // If we cannot fit the text at this position, return false
                    // and go to the next position.
                    if (!canFitText(gx, gy, gw, gh, info.occupied)) {
                        return false
                    }

                    // 把文本放在画布上
                    // Actually put the text on the canvas
                    drawText(gx, gy, info, word, weight,
                        (maxRadius - r), gxy[2], rotateDeg, attributes, extraDataArray)

                    // 将网格上的空格标记为已填充
                    // Mark the spaces on the grid as filled
                    updateGrid(gx, gy, gw, gh, info, item)

                    // 返回 true 所以 some() 将停止并返回 true。
                    // Return true so some() will stop and also return true.
                    return true
                }

                while (r--) {
                    var points = getPointsAtRadius(maxRadius - r)

                    if (settings.shuffle) {
                        points = [].concat(points)
                        shuffleArray(points)
                    }

                    // 尝试通过查看每个点来拟合单词。
                    // array.some() 将停止并返回 true
                    // 当 putWordAtPoint() 返回 true 时。
                    // 如果所有点都返回 false，则 array.some() 返回 false。
                    // Try to fit the words by looking at each point.
                    // array.some() will stop and return true
                    // when putWordAtPoint() returns true.
                    // If all the points returns false, array.some() returns false.
                    var drawn = points.some(tryToPutWordAtPoint)

                    if (drawn) {
                        // 离开 putWord() 并返回 true
                        // leave putWord() and return true
                        return true
                    }
                }
                if (settings.shrinkToFit) {
                    if (Array.isArray(item)) {
                        item[1] = item[1] * 3 / 4
                    } else {
                        item.weight = item.weight * 3 / 4
                    }
                    return putWord(item)
                }
                // 我们尝试了所有距离，但文本不适合，返回 false
                // we tried all distances but text won't fit, return false
                return false
            }

            // 发送自定义监听事件
            var sendEvent = function sendEvent(type, cancelable, details) {
                if (cancelable) {
                    return !myEmitter.emit(type, { detail: details || {} })
                } else {
                    myEmitter.emit(type, { detail: details || {} })
                }
            }
            // myEmitter.on("test", (e) => {
            //     console.log("测试事件被触发", e)
            // })
            // console.log("接收返回值", sendEvent("test", true, "123"))
            /* 开始绘制canvas */
            /* Start drawing on a canvas */
            var start = function start() {

                // 对于尺寸，clearCanvas 等，
                // 我们只关心第一个元素。
                // For dimensions, clearCanvas etc.,
                // we only care about the first element.
                var canvas = elements

                ngx = Math.ceil(canvas.width / g)
                ngy = Math.ceil(canvas.height / g)

                // 发送导致前一个循环停止的 wordcloudstart 事件。[无效函数调用]
                // 如果事件被取消，什么都不做。
                // Sending a wordcloudstart event which cause the previous loop to stop.
                // Do nothing if the event is canceled.
                if (!sendEvent('wordcloudstart', true)) {
                    resolve()
                }

                // 确定词云的中心
                // Determine the center of the word cloud
                center = (settings.origin) ? [settings.origin[0] / g, settings.origin[1] / g] : [ngx / 2, ngy / 2]

                // 寻找空间的最大半径
                // Maxium radius to look for space
                maxRadius = Math.floor(Math.sqrt(ngx * ngx + ngy * ngy))

                // 仅当设置了 clearCanvas 时才清除画布，如果未设置，则将网格更新为当前画布状态
                /* Clear the canvas only if the clearCanvas is set,
                   if not, update the grid to the current canvas state */
                grid = []

                var gx, gy, i
                var ctx = elements.getContext('2d')
                ctx.fillStyle = settings.backgroundColor
                ctx.clearRect(0, 0, ngx * (g + 1), ngy * (g + 1))
                ctx.fillRect(0, 0, ngx * (g + 1), ngy * (g + 1))

                /* 用空状态填充网格 */
                /* fill the grid with empty state */
                gx = ngx
                while (gx--) {
                    grid[gx] = []
                    gy = ngy
                    while (gy--) {
                        grid[gx][gy] = true
                    }
                }

                // 如果需要的话，用空状态填充 infoGrid
                // fill the infoGrid with empty state if we need it
                if (settings.hover || settings.click) {
                    interactive = true

                    /* 用空状态填充网格 */
                    /* fill the grid with empty state */
                    gx = ngx + 1
                    while (gx--) {
                        infoGrid[gx] = []
                    }
                }

                i = 0
                // 监听代码
                var loopingFunction, stoppingFunction
                if (settings.wait !== 0) {
                    loopingFunction = setTimeout
                    stoppingFunction = clearTimeout
                } else {
                    loopingFunction = setImmediate
                    stoppingFunction = clearImmediate
                }

                // 添加和移除监听封装
                var addEventListener = function addEventListener(type, listener) {
                    // elements.forEach(function (el) {
                    //   el.addEventListener(type, listener)
                    // }, this)
                    // console.log("添加监听", { type, listener })
                    myEmitter.addListener(type, listener)
                }

                var removeEventListener = function removeEventListener(type, listener) {
                    // elements.forEach(function(el) {
                    //     el.removeEventListener(type, listener)
                    // }, this)
                    // console.log("移除监听", { type, listener })
                    myEmitter.removeListener(type, listener)
                }

                var anotherWordCloudStart = function anotherWordCloudStart() {
                    removeEventListener('wordcloudstart', anotherWordCloudStart)
                    stoppingFunction(timer[timerId])
                }

                var stopFunction = function stopFunction() {
                    resolve()
                }

                addEventListener('wordcloudstart', anotherWordCloudStart)
                addEventListener('wordcloudstop', stopFunction)
                addEventListener('wordcloudabort', stopFunction)

                timer[timerId] = loopingFunction(function loop() {
                    if (i >= settings.list.length) {
                        stoppingFunction(timer[timerId])
                        sendEvent('wordcloudstop', false)
                        removeEventListener('wordcloudstart', anotherWordCloudStart)
                        delete timer[timerId];
                        return
                    }
                    escapeTime = (new Date()).getTime()
                    var drawn = putWord(settings.list[i])
                    var canceled = !sendEvent('wordclouddrawn', true, {
                        item: settings.list[i],
                        drawn: drawn
                    })
                    if (exceedTime() || canceled) {
                        stoppingFunction(timer[timerId])
                        sendEvent('wordcloudabort', false)
                        sendEvent('wordcloudstop', false)
                        removeEventListener('wordcloudstart', anotherWordCloudStart)
                        delete timer[timerId]
                        settings.abort()
                        return
                    }
                    i++
                    timer[timerId] = loopingFunction(loop, settings.wait)
                }, settings.wait)
            }
            // 一切就绪，开始绘图
            // All set, start the drawing
            start()
        })
    }

    WordCloud.isSupported = isSupported
    WordCloud.minFontSize = minFontSize
    WordCloud.stop = function stop() {
        if (timer) {
            for (var timerId in timer) {
                window.clearImmediate(timer[timerId])
            }
        }
    }

    module.exports = WordCloud // eslint-disable-line no-undef
})(this) // jshint ignore:line
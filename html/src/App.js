import React, {Component} from 'react';
import { createRoot } from 'react-dom/client';
import AceEditor from 'react-ace';
import SampleAnalyst from './SampleAnalyst.js';
import './App.css';

import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/theme-github';

function compareCanvases(liveCanvas, goalCanvas, diffCanvas, backgroundColour) {
    const width = liveCanvas.width,
        height = liveCanvas.height,
        backgroundPixel = [
            parseInt(backgroundColour.substring(1, 3), 16),
            parseInt(backgroundColour.substring(3, 5), 16),
            parseInt(backgroundColour.substring(5, 7), 16),
            255
        ],
        liveContext = liveCanvas.getContext('2d', {willReadFrequently: true}),
        goalContext = goalCanvas.getContext('2d', {willReadFrequently: true}),
        diffContext = diffCanvas.getContext('2d'),
        liveData = liveContext.getImageData(0, 0, width, height),
        goalData = goalContext.getImageData(0, 0, width, height),
        diffData = diffContext.createImageData(width, height);
    let diffCount = 0,
        foregroundCount = 0;
    for (let x=0; x < width; x++) {
        for (let y=0; y < height; y++) {
            const livePixel = slicePixel(liveData, x, y),
                goalPixel = slicePixel(goalData, x, y),
                [isMatch, diffPixel] = comparePixel(livePixel, goalPixel),
                isLiveBackground = comparePixel(livePixel, backgroundPixel)[0],
                isGoalBackground = comparePixel(goalPixel, backgroundPixel)[0],
                start = pixelStart(diffData, x, y);
            if ( ! (isLiveBackground && isGoalBackground)) {
                foregroundCount += 1;
            }
            if ( ! isMatch) {
                diffCount += 1
            }
            diffData.data.set(diffPixel, start);
        }
    }
    diffContext.putImageData(diffData, 0, 0);
    return 100*(1 - (diffCount / foregroundCount));
}

/** Compare two pixels
 *
 * If the two colours are within the tolerance, choose a faded version of the
 * colour, otherwise add red to highlight the difference.
 * @param colour1 first colour to compare
 * @param colour2 other colour to compare to
 * @param [tolerance] maximum difference between r, g, b components
 *  of the two colours.
 * @return Array [isMatch, [r, g, b, alpha]]
 */
function comparePixel(colour1, colour2, tolerance) {
    if (tolerance === undefined) {
        tolerance = 2;
    }
    const [r1, g1, b1, a1] = colour1,
        [r2, g2, b2, a2] = colour2,
        maxDiff = Math.max(
            Math.abs(r1-r2),
            Math.abs(g1-g2),
            Math.abs(b1-b2));  // ignore alpha differences
    if (tolerance < maxDiff) {
        // Highlight difference
        return [
            false,
            [255, Math.floor((g1+g2) / 5), Math.floor((b1+b2) / 5), 255]
        ];
    }
    return [true, [r1, g1, b1, Math.floor((a1 + a2)/6)]];
}

function pixelStart(imageData, x, y) {
    return 4*(y*imageData.width + x);
}

function slicePixel(imageData, x, y) {
    const start = pixelStart(imageData, x, y);
    return imageData.data.slice(start, start+4);
}

class ProgressBar extends Component {
    render() {
        let stateClass = (this.props.percentage < 50) ?
            "danger" :
            (this.props.percentage < 100) ?
                "warning" :
                "success";
        // noinspection HtmlUnknownAttribute
        return <progress className={stateClass} type={stateClass} value={`${this.props.percentage}`} max="100"/>;
    }
}

class Editor extends Component {
    constructor(props) {
        super(props);
        this.state = {selectedLine: undefined};
        this.content = React.createRef();
        this.handleScroll = this.handleScroll.bind(this);
    }

    handleScroll() {
        this.props.onScroll(this.content.current.editor.session.getScrollTop());
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        this.content.current.editor.session.setScrollTop(this.props.scrollTop);
        if (this.props.selectedLine !== this.state.selectedLine) {
            this.setState({selectedLine: this.props.selectedLine});
            this.content.current.editor.gotoLine(
                this.props.selectedLine+1,
                0,
                false);
        }
        this.content.current.editor.resize();
    }

    render() {
        // noinspection JSUnresolvedVariable
        return <AceEditor
            ref={this.content}
            value={this.props.value}
            onChange={this.props.onChange}
            readOnly={this.props.readOnly}
            onScroll={this.handleScroll}
            onSelectionChange={this.props.onSelectionChange}
            onCursorChange={this.props.onCursorChange}
            mode={this.props.mode}
            theme="github"
            width="100%"
            height="100%"
            fontSize={18}
            showPrintMargin={true}
            markers={this.props.markers}
            showGutter={true}
            highlightActiveLine={this.props.highlightActiveLine}
            editorProps={{
                $blockScrolling: Infinity
            }}
            setOptions={{
                showLineNumbers: true,
                tabSize: 4,
            }}/>;
    }
}

class CodeSample extends Component {
    constructor(props) {
        super(props);
        const sourceCode = props.source,
            analyst = new SampleAnalyst(sourceCode);
        this.state = {
            scrollTop: 0,
            selectedLine: undefined,
            isPythonLoaded: false,
            hasDisplayed: false,
            source: analyst.sourceCode,
            originalSource: analyst.sourceCode,
            goalSourceCode: analyst.goalSourceCode,
            display: analyst.display,
            goalOutput: analyst.goalOutput,
            goalCanvasCommands: analyst.goalCanvasCommands,
            output: analyst.output,
            goalMarkers: analyst.goalMarkers,
            outputMarkers: analyst.outputMarkers,
            matchPercentage: analyst.matchPercentage,
            isLive: analyst.isLive,
            isCanvas: analyst.isCanvas,
            canvasCommands: analyst.canvasCommands,
            canvasWidth: undefined,
            canvasHeight: undefined
        };

        this.handleChange = this.handleChange.bind(this);
        this.scheduleUpdate = this.scheduleUpdate.bind(this);
        this.updateDisplay = this.updateDisplay.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleCursorChange = this.handleCursorChange.bind(this);

        props.spaceTracerPromise.then(() => {
            this.setState({isPythonLoaded: true})
        });

        this.editorRef = React.createRef();
        this.canvasRef = React.createRef();
        this.goalCanvasRef = React.createRef();
        this.diffCanvasRef = React.createRef();
    }

    handleChange(newSource) {
        if (newSource !== undefined) {
            this.setState({source: newSource});
        }
        this.scheduleUpdate();
    }

    scheduleUpdate() {
        if (this.updateTimer !== undefined) {
            return;
        }
        this.updateTimer = setInterval(this.updateDisplay, 300);
    }

    updateDisplay() {
        if (this.updateTimer !== undefined) {
            clearInterval(this.updateTimer);
        }
        let codeRunner = this.state.isPythonLoaded ? window.analyze : undefined,
            canvas = this.canvasRef.current,
            canvasSize,
            isResized = false,
            newSource = this.state.source;
        if (canvas !== null) {
            this.resizeCanvas(canvas);
            canvasSize = [canvas.width, canvas.height];
            isResized = (canvas.width !== this.state.canvasWidth ||
                canvas.height !== this.state.canvasHeight);
        }
        let goalOutput = isResized ? undefined : this.state.goalOutput,
            goalCanvasCommands = isResized
                ? undefined
                : this.state.goalCanvasCommands,
            analyst = new SampleAnalyst(
                newSource,
                codeRunner,
                goalOutput,
                goalCanvasCommands,
                this.state.goalSourceCode,
                this.state.isLive,
                this.state.isCanvas,
                canvasSize
            );
        this.setState({
            source: newSource,
            display: analyst.display,
            output: analyst.output,
            goalOutput: analyst.goalOutput,
            goalMarkers: analyst.goalMarkers,
            outputMarkers: analyst.outputMarkers,
            canvasCommands: analyst.canvasCommands,
            goalCanvasCommands: analyst.goalCanvasCommands
        });
        this.updateTimer = undefined;
        Promise.all(analyst.imagePromises).then(() => {
            analyst.imagePromises.length = 0;
            this.drawCanvas(analyst.canvasCommands, this.canvasRef);
            this.drawCanvas(analyst.goalCanvasCommands, this.goalCanvasRef);
            let matchPercentage = this.compareCanvases(analyst.goalCanvasCommands);
            if (matchPercentage === undefined) {
                matchPercentage = analyst.matchPercentage;
            }
            this.setState({matchPercentage: matchPercentage});
        });
        if (isResized) {
            this.setState({
                canvasWidth: canvasSize[0],
                canvasHeight: canvasSize[1]
            });
        }
    }

    compareCanvases(goalCanvasCommands) {
        const liveCanvas = this.canvasRef.current,
            goalCanvas = this.goalCanvasRef.current,
            diffCanvas = this.diffCanvasRef.current;
        let matchPercentage = undefined;
        if (diffCanvas !== null) {
            diffCanvas.width = liveCanvas.width;
            diffCanvas.height = liveCanvas.height;
            let backgroundColor = '#ffffff';
            for (let command of goalCanvasCommands) {
                if (command.name === 'bgcolor') {
                    backgroundColor = command.fill;
                }
            }
            matchPercentage = compareCanvases(
                liveCanvas,
                goalCanvas,
                diffCanvas,
                backgroundColor);
        }
        return matchPercentage;
    }

    handleReset() {
        this.handleChange(this.state.originalSource);
    }

    handleScroll(scrollTop) {
        this.setState({scrollTop: scrollTop});
    }

    handleCursorChange(selection) {
        // noinspection JSUnresolvedFunction
        this.setState({selectedLine: selection.getSelectionLead().row});
    }

    handleResize = () => {
        if (this.state.isCanvas) {
            this.handleChange();
        }
    };

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        this.drawCanvas(this.state.canvasCommands, this.canvasRef);
        this.drawCanvas(this.state.goalCanvasCommands, this.goalCanvasRef);
        this.scheduleUpdate();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    calculateEditorHeight() {
        const textHeight = (1 + this.countLines(this.state.source))*18,
            viewHeight = Math.round(window.innerHeight * 0.8);
        if (this.state.goalSourceCode !== undefined) {
            return Math.min(textHeight, Math.floor(viewHeight / 2));
        }
        return Math.min(textHeight, viewHeight);
    }

    calculateCanvasHeight() {
        const aspectHeight = this.editorRef.current.clientWidth * 0.75,
            viewHeight = Math.round(window.innerHeight * 0.8);
        if (this.state.goalSourceCode !== undefined) {
            return Math.min(aspectHeight, Math.floor(viewHeight / 2));
        }
        return Math.min(aspectHeight, viewHeight);
    }

    calculateGoalHeight() {
        if (this.state.isCanvas) {
            return this.calculateCanvasHeight();
        }
        const outputLines = Math.max(
                this.countLines(this.state.goalOutput),
                this.countLines(this.state.output)),
            textHeight = outputLines*18,
            viewHeight = Math.round(window.innerHeight * 0.8);
        return Math.min(textHeight, Math.floor(viewHeight / 2));
    }

    resizeCanvas(canvas) {
        canvas.width = this.editorRef.current.clientWidth;
        canvas.height = this.calculateCanvasHeight();
    }

    drawCanvas(commands, canvasRef) {
        const canvas = canvasRef.current;
        if ((canvas === null) || (commands === undefined)) {
            return;
        }
        this.resizeCanvas(canvas);
        const ctx = canvas.getContext('2d', {willReadFrequently: true});
        ctx.translate(0.5, 0.5); // Centre lines on pixels.
        ctx.lineCap = 'round';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const command of commands) {
            if (command.name === 'bgcolor') {
                ctx.fillStyle = command.fill;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } if (command.name === 'create_line') {
                ctx.beginPath();
                ctx.moveTo(command.coords[0], command.coords[1]);
                ctx.lineTo(command.coords[2], command.coords[3]);
                ctx.lineWidth = command.pensize;
                ctx.strokeStyle = command.fill;
                ctx.stroke();
            }
            else if (command.name === 'create_polygon') {
                ctx.beginPath();
                ctx.moveTo(command.coords[0], command.coords[1]);
                for (let i = 2; i < command.coords.length; i += 2) {
                    ctx.lineTo(command.coords[i], command.coords[i+1]);
                }
                ctx.fillStyle = command.fill;
                ctx.fill('evenodd');
            }
            else if (command.name === 'create_text') {
                ctx.font = command.font;
                ctx.fillStyle = command.fill;
                ctx.textAlign = command.anchor === 'sw'
                    ? 'left'
                    : command.anchor === 'se'
                    ? 'right'
                    : 'center';
                ctx.fillText(command.text, command.coords[0], command.coords[1]);
            }
            else if (command.name === 'create_image') {
                ctx.drawImage(command.image, command.coords[0], command.coords[1]);
            }
        }
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if ( ! this.state.isPythonLoaded) {
            // Continue waiting...
        }
        else if ( ! this.state.hasDisplayed) {
            this.setState({hasDisplayed: true});
            this.scheduleUpdate();
        }
        else if ((5 < Math.abs(prevState.canvasWidth - this.state.canvasWidth)) ||
                (prevState.source !== this.state.source) ||
                (prevState.goalCanvasCommands === undefined &&
                    this.state.goalCanvasCommands !== undefined)) {
            this.scheduleUpdate();
        }
    }

    countLines(text) {
        return text.split(/\r\n|\r|\n/).length;
    }

    render() {
        let displayValue = 'Python is loading...';
        if (this.state.isPythonLoaded) {
            displayValue = this.state.display;
        }
        let displayDiv = null,
            progressBar = null,
            outputHeaders = null,
            outputSection = null,
            resetButton = null,
            editorHeight = this.calculateEditorHeight();
        if (this.state.isLive) {
            if (this.state.isCanvas) {
                displayDiv = <canvas ref={this.canvasRef}/>;
            } else {
                displayDiv = <div
                    className="editor-pane"
                    style={{height: editorHeight + "px"}}>
                    <Editor
                        value={displayValue}
                        scrollTop={this.state.scrollTop}
                        readOnly={true}
                        selectedLine={this.state.selectedLine}
                        onChange={this.handleChange}
                        onScroll={this.handleScroll}
                        highlightActiveLine={true}
                        mode="text"/>
                </div>;
            }
        }
        if (this.state.source !== this.state.originalSource) {
            resetButton = <div className="reset-wrapper">
                <button className="reset-code" onClick={this.handleReset}>Reset</button>
            </div>;
        }
        if (this.state.goalOutput !== undefined) {
            const goalHeight = this.calculateGoalHeight();
            progressBar = <ProgressBar percentage={this.state.matchPercentage}/>;
            if (this.state.isCanvas) {
                outputHeaders = <div className="editor-wrapper">
                    <h4 className="editor-header">Goal Canvas</h4>
                    <h4 className="editor-header">Canvas Differences</h4>
                </div>;
                displayDiv = <canvas ref={this.canvasRef}/>;
                outputSection = <div className="editor-wrapper">
                    <canvas ref={this.goalCanvasRef}/>
                    <canvas ref={this.diffCanvasRef}/>
                </div>;
            } else {
                outputHeaders = <div className="editor-wrapper">
                    <h4 className="editor-header">Goal output</h4>
                    <h4 className="editor-header">Your output</h4>
                </div>;
                outputSection = <div className="editor-wrapper">
                    <div className="editor-pane"
                         style={{height: goalHeight + "px"}}>
                        <Editor
                            value={this.state.goalOutput}
                            markers={this.state.goalMarkers}
                            readOnly={true}
                            highlightActiveLine={false}
                            mode="text"/>
                    </div>
                    <div className="editor-pane"
                         style={{height: goalHeight + "px"}}>
                        <Editor
                            value={this.state.output}
                            markers={this.state.outputMarkers}
                            readOnly={true}
                            highlightActiveLine={false}
                            mode="text"/>
                    </div>
                </div>;
            }
        }
        return (
            <div className="codeSample">
                <div className="editor-wrapper">
                    <div className="editor-pane"
                        ref={this.editorRef}
                        style={{height: editorHeight + "px"}}>
                        <Editor
                            value={this.state.source}
                            scrollTop={this.state.scrollTop}
                            onChange={this.handleChange}
                            onScroll={this.handleScroll}
                            onCursorChange={this.handleCursorChange}
                            highlightActiveLine={true}
                            mode="python"/>
                    </div>
                    {displayDiv}
                </div>
                {resetButton}
                {progressBar}
                {outputHeaders}
                {outputSection}
          </div>
    );
  }
}

class App extends Component {
    componentDidMount() {
        const spaceTracerPromise = new Promise((resolve, reject) => {
            // noinspection JSUnresolvedVariable
            if (window.pyodidePromise === undefined) {
                reject('Python is not loaded!');
            } else {
                let extraModules = window.liveCodingExtraModules;
                if (extraModules === undefined) {
                    extraModules = [];
                } else {
                    extraModules = extraModules.split(',');
                }
                // noinspection JSUnresolvedVariable
                window.pyodidePromise.then(function() {
                    for (const extraModule of extraModules) {
                        // noinspection JSUnresolvedFunction
                        window.pyodide.loadPackage(extraModule.trim());
                    }
                    // noinspection JSUnresolvedFunction
                    window.pyodide.loadPackage('space-tracer').then(() => {
                        // noinspection JSUnresolvedVariable,JSUnresolvedFunction
                        window.pyodide.runPython(
                            'from space_tracer.main import web_main; web_main()');
                        resolve();
                    }).catch(() => reject('Space Tracer failed.'));
                }).catch(() => reject('Pyodide failed.'));
            }
        });

        let search = window.location.search;
        let params = new URLSearchParams(search);
        let tutorialName = params.get('tutorial');
        if (tutorialName) {
            window.location = new URL(tutorialName, window.location);
        }

        const codeBlocks = document.getElementsByTagName('pre');

        for (const codeBlock of codeBlocks) {
            const parent = codeBlock.parentNode;
            // noinspection JSCheckFunctionSignatures
            const root = createRoot(parent);
            root.render(<CodeSample
                source={codeBlock.innerText}
                spaceTracerPromise={spaceTracerPromise}
            />);
        }
    }

    render() {
        return (
            <div className="app">
            </div>
        );
    }
}

export default App;
export {compareCanvases, slicePixel};

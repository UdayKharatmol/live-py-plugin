package io.github.donkirkby.livepy;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.ILog;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Path;
import org.eclipse.core.runtime.Status;
import org.eclipse.core.variables.IStringVariableManager;
import org.eclipse.core.variables.VariablesPlugin;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.jface.text.Document;
import org.eclipse.jface.text.DocumentEvent;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.IDocumentListener;
import org.eclipse.jface.text.IViewportListener;
import org.eclipse.jface.text.source.ISourceViewer;
import org.eclipse.jface.text.source.SourceViewer;
import org.eclipse.jface.text.source.SourceViewerConfiguration;
import org.eclipse.jface.text.source.VerticalRuler;
import org.eclipse.swt.SWT;
import org.eclipse.swt.custom.SashForm;
import org.eclipse.swt.events.ControlAdapter;
import org.eclipse.swt.events.ControlEvent;
import org.eclipse.swt.events.PaintEvent;
import org.eclipse.swt.events.PaintListener;
import org.eclipse.swt.graphics.Color;
import org.eclipse.swt.graphics.Device;
import org.eclipse.swt.graphics.Font;
import org.eclipse.swt.graphics.GC;
import org.eclipse.swt.graphics.Point;
import org.eclipse.swt.graphics.Rectangle;
import org.eclipse.swt.layout.FillLayout;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.Canvas;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Display;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;
import org.osgi.framework.Bundle;
import org.python.pydev.core.IPythonNature;
import org.python.pydev.core.IPythonPathNature;
import org.python.pydev.core.MisconfigurationException;
import org.python.pydev.core.log.Log;
import org.python.pydev.debug.ui.launching.PythonRunnerConfig;
import org.python.pydev.editor.PyEdit;
import org.python.pydev.editor.codefolding.PySourceViewer;
import org.python.pydev.pyunit.preferences.PyUnitPrefsPage2;
import org.python.pydev.ast.runners.UniversalRunner;
import org.python.pydev.ast.runners.UniversalRunner.AbstractRunner;
import org.python.pydev.shared_core.bundle.BundleUtils;
import org.python.pydev.shared_core.io.FileUtils;
import org.python.pydev.shared_core.structure.Tuple;
import org.python.pydev.shared_ui.editor.BaseEditor;

import io.github.donkirkby.livecanvas.CanvasCommand;
import io.github.donkirkby.livecanvas.CanvasCommand.FontOptions;
import io.github.donkirkby.livecanvas.CanvasReader;


/**
 * This actually runs the Python code and displays the analysis.
 * @author Don Kirkby
 *
 */
public class LiveCodingAnalyst {
    /**
     * Making it true will print some debug info to stdout.
     */
    private final static boolean DEBUG = false;
    
    public enum Mode {
        Hidden, // source code only
        Display, // variable values and iteration
        Turtle // turtle graphics
    }
    
    private static LinkedBlockingQueue<AnalysisTask> toAnalyse =
            new LinkedBlockingQueue<AnalysisTask>();
    private static Thread analysisThread = new Thread() {
        public void run() {
            try {
                while (true) {
                    AnalysisTask last = toAnalyse.take();
                    AnalysisTask next;
                    do {
                        next = toAnalyse.poll(0, TimeUnit.SECONDS);
                        if (next != null)
                        {
                            last = next;
                        }
                    } while (next != null);
                    last.analyst.analyseDocument(last.sourceCode, last.bounds);
                }
            } catch (InterruptedException e) {
                // Just exit the thread if it was interrupted.
            }
        };
    };
    
    static {
        analysisThread.setDaemon(true);
        analysisThread.start();
    }
    
	public static LiveCodingAnalyst getActiveAnalyst() {
		IWorkbenchWindow window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
        IEditorPart editor = window.getActivePage().getActiveEditor();
        LiveCodingAnalyst analyst = null;
        if (editor instanceof PyEdit) {
			analyst = PyEditDecorator.getAnalyst((PyEdit) editor);
        }
		return analyst;
	}

    private class AnalysisTask {
        public String sourceCode;
        public LiveCodingAnalyst analyst;
        public Rectangle bounds;
    }

    private ILog log = Activator.getDefault().getLog();
    private ISourceViewer mainViewer;
    private IDocument mainDocument;
    private Document displayDocument;
    private SourceViewer displayViewer;
    private int horizontalTarget;
    private int horizontalPosition;
    private File scriptPath;
    private ArrayList<CanvasCommand> canvasCommands = 
            new ArrayList<CanvasCommand>();
    private Composite editorContent;
    private Composite liveDisplay;
    private Canvas canvas;
    private Rectangle canvasBounds;
    private HashMap<String, Color> colorMap = new HashMap<String, Color>();
    private SashForm splitter;
    private Mode mode = Mode.Hidden;
    private volatile boolean isPassing = false;
    private ILaunchConfiguration launchConfig;

    /**
     * This callback inserts a new composite inside the standard window
     * and then returns the left pane of the splitter as the new parent
     * for the main editor controls.
     * @param parent The standard window that usually holds the editor.
     * @return The new control that the editor can be created in.
     */
    public Object createPartControl(Composite parent) {
        parent.setLayout(new GridLayout());
        parent.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));             

        splitter = new SashForm(parent, SWT.HORIZONTAL);
        splitter.setLayout(new FillLayout());
        splitter.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));           
        
        editorContent = new Composite(splitter, SWT.NONE);
        editorContent.setLayout(new FillLayout());
        GridData gridData = new GridData(SWT.FILL, SWT.FILL, true, true);
        editorContent.setLayoutData(gridData);
        
        canvas = new Canvas(splitter, SWT.NONE);
        
        liveDisplay = new Composite(splitter, SWT.NONE);
        liveDisplay.setLayout(new FillLayout());
        GridData gridData2 = new GridData(SWT.FILL, SWT.FILL, true, true);
        liveDisplay.setLayoutData(gridData2);
        
        VerticalRuler ruler = new VerticalRuler(12);
        int styles = 
                SWT.V_SCROLL | 
                SWT.H_SCROLL | 
                SWT.MULTI | 
                SWT.BORDER | 
                SWT.FULL_SELECTION;
        displayViewer = 
                new SourceViewer(liveDisplay, ruler, styles);
        SourceViewerConfiguration config = 
                new SourceViewerConfiguration();
        displayViewer.configure(config);
        displayDocument = new Document("");
        displayViewer.setDocument(displayDocument);
        
        displayViewer.addViewportListener(new IViewportListener() {
            
            /**
             * Update the scroll bar of the main viewer when the
             * display viewer is scrolled.
             */
            @Override
            public void viewportChanged(int verticalOffset) {
                if (mainViewer != null) {
                    mainViewer.getTextWidget().setTopPixel(
                            verticalOffset);
                    mainViewer.invalidateTextPresentation();
                }
            }
        });
        
        new TextViewerSupport(displayViewer); // registers itself

        canvas.addPaintListener(new PaintListener() {
            
            @Override
            public void paintControl(PaintEvent e) {
                drawResult(e.gc);
            }
        });
        
        canvas.addControlListener(new ControlAdapter() {
            @Override
            public void controlResized(ControlEvent e) {
                canvasBounds = canvas.getBounds();
                refresh();
            }
        });
        
        setModeNow();

        return editorContent;
    }

    /**
     * The current display mode.
     */
    public Mode getMode() {
		return mode;
	}
    
    /**
     * True if the last analysis didn't raise any errors.
     */
    public boolean isPassing() {
		return isPassing;
	}
    
    /**
     * Copy the style settings from the main viewer to the display
     * viewer.
     * @param newViewer The main viewer that was just created.
     * @return The main viewer.
     */
    public Object afterCreateControl(ISourceViewer newViewer) {
        mainViewer = newViewer;
        displayViewer.getTextWidget().setFont(
                mainViewer.getTextWidget().getFont());
        return newViewer;
    }

    /**
     * Wire up the main viewer after it's created.
     * @param viewer The main viewer that was just created.
     * @return The main viewer.
     */
    public Object createSourceViewer(PySourceViewer newViewer) {
        newViewer.addViewportListener(new IViewportListener() {
            
            /**
             * Update the scroll bar of the display viewer when the main
             * viewer is scrolled.
             * @param viewer The main viewer.
             * @return
             */
            @Override
            public void viewportChanged(int verticalOffset) {
                if (displayViewer != null) {
                    displayViewer.getTextWidget().setTopPixel(
                            verticalOffset);
                }
            }
        });
        return newViewer;
    }
    
    /**
     * Set the visibility of the live coding display.
     * @param isVisible
     */
    public void setMode(final Mode mode) {
        this.mode = mode;
        // Can only change visibility on the UI thread.
        Display.getDefault().asyncExec(new Runnable() {
            public void run() {
                setModeNow();
            }
        });
    }

    private void setModeNow() {
        if (splitter != null) {
            if (mode == Mode.Turtle) {
                liveDisplay.setVisible(false);
                canvas.setVisible(true);
            }
            else {
                canvas.setVisible(false);
                liveDisplay.setVisible(true);
            }
            // If live display and turtle are not visible, maximize main editor.
            splitter.setMaximizedControl(mode == Mode.Hidden ? editorContent : null);
            if (mode != Mode.Hidden) {
                splitter.layout();
                refresh();
            }
        }
    }

    /**
     * Wire up the main document and perform the first analysis.
     */
    public void onSetDocument(
            IDocument document, 
            BaseEditor edit,
            IProgressMonitor monitor) {
        mainDocument = document;
        document.addDocumentListener(new IDocumentListener() {

            /**
             * Analyse the document and display the results whenever the
             * document changes.
             */
            @Override
            public void documentChanged(DocumentEvent event) {
                if (mode != Mode.Hidden)
                {
                    addAnalysisTask(event.getDocument());
                }
            }
            
            @Override
            public void documentAboutToBeChanged(DocumentEvent event) {
            }
        });
    }

    public void refresh() {
        addAnalysisTask(mainDocument);
    }
    
    /** Remove any current analysis, but don't trigger another. */
    public void reset() {
        canvasCommands.clear();
    }

    /**
     * Analyse the document and display the results.
     * @param document
     */
    private void analyseDocument(String sourceCode, Rectangle bounds) {
    	String results;
        try {
            Process process = launchProcess(bounds);
            if (process == null)
            {
                return;
            }
            PrintWriter writer = new PrintWriter(new BufferedWriter(
                    new OutputStreamWriter(process.getOutputStream())));
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
            BufferedReader errorReader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream()));
            try {
                writer.write(sourceCode);
                writer.close();
                if(DEBUG){
                    System.out.println("Writing: " + sourceCode);
                }
                
                results = loadResults(reader, countLines(sourceCode));
                if (DEBUG) {
                    String line;
                    do
                    {
                        line = errorReader.readLine();
                        if (line != null) {
                            System.out.println(line);
                        }
                    } while (line != null);
                }
            } finally {
                writer.close();
                reader.close();
                errorReader.close();
            }
            isPassing = process.waitFor() == 0;
        } catch (Exception e) {
            results = e.getMessage();
            if (results == null) {
                results = e.toString();
            }
        }
        displayResults(results);
    }

    private List<String> getDriverArguments(IPythonNature nature) {
        List<String> argumentList = new ArrayList<String>();
        ILaunchConfiguration launchConfig = this.launchConfig;
        if (launchConfig == null) {
            return argumentList;
        }
        try {
            String driverScript = launchConfig.getAttribute(
                    "org.eclipse.ui.externaltools.ATTR_LOCATION",
                    "");
            IStringVariableManager variableManager = 
                    VariablesPlugin.getDefault().getStringVariableManager();
            driverScript = variableManager.performStringSubstitution(driverScript);
            String launchType = launchConfig.getType().getIdentifier();
            final String testType =
                    "org.python.pydev.debug.unittestLaunchConfigurationType";
            if ( ! launchType.equals(testType)) {
                argumentList.add(driverScript);
            }
            else {
            	IProject project =
            			PythonRunnerConfig.getProjectFromConfiguration(
            					launchConfig);
            	int testRunner = PyUnitPrefsPage2.getTestRunner(
            			launchConfig,
            			project);
                String[] selectedTests = launchConfig.getAttribute(
                        "org.python.pydev.debug.ATTR_UNITTEST_TESTS",
                        "").split(",");
                if (selectedTests.length == 0 || 
                		(selectedTests.length == 1 &&
                		 selectedTests[0].length() == 0)) {
					selectedTests = null;
				}
            	if (testRunner == PyUnitPrefsPage2.TEST_RUNNER_PYDEV) {
                    argumentList.add("-m");
                    argumentList.add("unittest");
                    final String moduleName =
                            getModuleName(new File(driverScript), nature);
                    if (selectedTests == null) {
                        argumentList.add(moduleName);
                    }
                    else {
						for (String testName : selectedTests) {
                            argumentList.add(moduleName + "." + testName);
                        }
                    }
				} else if (testRunner == PyUnitPrefsPage2.TEST_RUNNER_PY_TEST) {
					argumentList.add("-m");
					argumentList.add("pytest");
					if (selectedTests == null) {
						argumentList.add(driverScript);
					} else {
						for (String testName : selectedTests) {
							argumentList.add(
									driverScript + "::" +
									testName.replace(".", "::"));
						}
					}
					// -m pytest test_anagrams.py::AnagramsTest::test test_anagrams.py::AnagramsTest::test_case
				}
            }
            String driverArgs = launchConfig.getAttribute(
                    "org.eclipse.ui.externaltools.ATTR_TOOL_ARGUMENTS",
                    "");
            if (driverArgs.length() > 0) {
                argumentList.addAll(Arrays.asList(driverArgs.split(" ")));
            }
        } catch (CoreException e) {
            log.log(new Status(
                    IStatus.ERROR,
                    Activator.PLUGIN_ID,
                    "Can't read launch configuration.",
                    e));
        }
        return argumentList;
    }

    private int countLines(String text) {
        Matcher matcher = 
                Pattern.compile("\n|\r\n|\n\r").matcher(text);
        int lineCount = 0;
        while (matcher.find()) {
            lineCount++;
        }
        return lineCount;
    }

    private void displayResults(final String results) {
        // The document can only be updated from the display thread.
        Display.getDefault().asyncExec(new Runnable() {
            public void run() {
                if (mode == Mode.Turtle) {
                    redraw();
                    Activator.getDefault().refreshElements(TurtleHandler.COMMAND_ID);
                }
                else {
                    final int horizontalNow =
                            displayViewer.getTextWidget().getHorizontalPixel();
                    if (horizontalNow != horizontalPosition) {
                        horizontalTarget = horizontalNow;
                    }
                    displayDocument.set(results);
    
                    // Update the scroll position after changing the text.
                    displayViewer.getTextWidget().setTopPixel(
                            mainViewer.getTextWidget().getTopPixel());
                    displayViewer.getTextWidget().setHorizontalPixel(
                            horizontalTarget);
                    horizontalPosition =
                            displayViewer.getTextWidget().getHorizontalPixel();
                    Activator.getDefault().refreshElements(StartHandler.COMMAND_ID);
                }
            }
        });
    }

    private Process launchProcess(Rectangle bounds) throws IOException {
        checkScriptPath();
        if(mainViewer == null){
            return null;
        }
        PyEdit pyEdit = ((PySourceViewer)mainViewer).getEdit();
        IPythonNature nature;
        try {
            nature = pyEdit.getPythonNature();
            if (nature == null)
            {
                return null;
            }
        } catch (MisconfigurationException e) {
            Log.log(e);
            return null;
        }
        AbstractRunner runner = UniversalRunner.getRunner(nature);
        File editorFile = pyEdit.getEditorFile();
        ArrayList<String> argumentList = new ArrayList<String>();
        argumentList.add("-f");
        argumentList.add(editorFile.getAbsolutePath());
        if (bounds != null) {
            argumentList.add("-c");
            argumentList.add("-x");
            argumentList.add(Integer.toString(bounds.width));
            argumentList.add("-y");
            argumentList.add(Integer.toString(bounds.height));
        }
        List<String> driverArguments = getDriverArguments(nature);
        if (driverArguments.size() > 0) {
            argumentList.add("-"); // source code from stdin
            try {
                String moduleName = getModuleName(
                        pyEdit.getEditorFile(),
                        nature);
                argumentList.add(moduleName);
            } catch (CoreException e) {
                log.log(new Status(
                        IStatus.ERROR,
                        Activator.PLUGIN_ID,
                        "Can't determine module name.",
                        e));
            }
            argumentList.addAll(driverArguments);
        } 
        String[] arguments = 
                (String[])argumentList.toArray(new String[argumentList.size()]);
        Tuple<Process, String> tuple = runner.createProcess(
                FileUtils.getFileAbsolutePath(scriptPath), 
                arguments, 
                editorFile.getParentFile(), 
                null);
        if(tuple.o1 != null){
            if(DEBUG){
                System.out.println("Launched: "+tuple.o2);
            }
            Process process = tuple.o1;
            return process;
        }
        if(DEBUG){
            System.out.println("Unable to make launch.");
        }
        return null;
    }

    private String getModuleName(File file, IPythonNature nature)
            throws CoreException {
        IPythonPathNature pythonPathNature = nature.getPythonPathNature();
        String pythonPath = pythonPathNature.getOnlyProjectPythonPathStr(true);
        int pipeIndex = pythonPath.indexOf('|');
        if (pipeIndex >= 0) {
            pythonPath = pythonPath.substring(0, pipeIndex);
        }
        java.nio.file.Path filePath;
        filePath = Paths.get(pythonPath).relativize(file.toPath());
        String moduleName = "";
        for (java.nio.file.Path component : filePath) {
            if (moduleName.length() > 0) {
                moduleName += ".";
            }
            moduleName += component.getFileName();
        }
        if (moduleName.endsWith(".py")) {
            moduleName = moduleName.substring(0, moduleName.length()-3);
        }
        return moduleName;
    }

    private String loadResults(BufferedReader reader, int minLineCount) 
            throws IOException {
        String line;
        StringWriter writer = new StringWriter();
        PrintWriter printer = new PrintWriter(writer);
        int lineCount = 0;
        boolean isStarted = false;
        do {
            line = reader.readLine();

            if (line != null) {
                if(DEBUG){
                    System.out.println("load results line: "+line);
                }
                if (isStarted) {
                    printer.println(line);
                    lineCount++;
                }
                else {
                    if (line.equals("start_canvas")) {
                    	canvasCommands = new CanvasReader(reader).readCommands();
                    }
                    else {
                        canvasCommands = new ArrayList<CanvasCommand>();
                        printer.println(line);
                        lineCount++;
                    }
                    isStarted = true;
                }
            }
        } while (line != null);
        while (lineCount < minLineCount) {
            printer.println();
            lineCount++;
        }
        return writer.toString();
    }

	private void checkScriptPath() {
        if (scriptPath != null)
        {
            return;
        }
        Bundle bundle = Activator.getDefault().getBundle();
        Path sourceFolder = new Path("PySrc");
        scriptPath = BundleUtils.getRelative(
                sourceFolder.append("space_tracer/code_tracer.py"),
                bundle);
        String[] otherScripts = new String[] {
                "space_tracer/report_builder.py",
                "space_tracer/canvas.py",
                "space_tracer/mock_turtle.py"
        };
        for (String script : otherScripts) {
            BundleUtils.getRelative(
                    sourceFolder.append(script),
                    bundle);
        }
        if(DEBUG){
            System.out.println("Script path: "+scriptPath);
        }
    }

    public ArrayList<CanvasCommand> getCanvasCommands() {
        return canvasCommands;
    }

    private void addAnalysisTask(IDocument document) {
        if (document == null) {
            return;
        }
        
        AnalysisTask task = new AnalysisTask();
        task.sourceCode = document.get();
        task.analyst = LiveCodingAnalyst.this;
        task.bounds = getBounds();
        toAnalyse.add(task);
    }
    
    public void redraw() {
        if (canvas != null) {
            canvas.redraw();
        }
    }
    
    public Rectangle getBounds() {
        // cache the bounds so we can see them from a background thread.
        return canvasBounds; 
    }
    
    private void drawResult(GC gc) {
        // Clear the drawing
        Rectangle bounds = getBounds();
        gc.fillRectangle(0, 0, bounds.width, bounds.height);
        
        String message = null;
        ArrayList<CanvasCommand> canvasCommands = null;
        canvasCommands = getCanvasCommands();
        if (canvasCommands == null || canvasCommands.size() == 0) {
            message = "No turtle commands found.\n" +
                    "For example:\n" +
                    "from turtle import *\n" +
                    "forward(100)";
        }
        if (message != null) {
            Point extent = gc.textExtent(message);
            gc.drawText(
                    message, 
                    (bounds.width - extent.x)/2, 
                    (bounds.height - extent.y)/2,
                    SWT.DRAW_TRANSPARENT +
                    SWT.DRAW_DELIMITER);
            return;
        }
        // Execute the drawing commands
        for (CanvasCommand command : canvasCommands) {
            String method = command.getName();
            String fill = command.getOption("fill");
            String outline = command.getOption("outline");
            String newLineWidthText = command.getOption("pensize");
            Color oldForeground = gc.getForeground();
            Color newForeground = null;
            Color oldBackground = gc.getBackground();
            Color newBackground = null;
            int oldLineWidth = gc.getLineWidth();
            if (outline != null) {
                newForeground = getColor(outline);
                newBackground = getColor(fill);
            }
            else {
                newForeground = getColor(fill);
            }
            if (newForeground != null) {
                gc.setForeground(newForeground);
            }
            if (newBackground != null) {
                gc.setBackground(newBackground);
            }
            if (newLineWidthText != null) {
                int newLineWidth =
                        (int)Math.round(Double.parseDouble(newLineWidthText));
                gc.setLineWidth(newLineWidth);
                gc.setLineCap(SWT.CAP_ROUND);
            }
            if (method.equals("bgcolor")) {
                gc.fillRectangle(0, 0, bounds.width, bounds.height);
			}
            else if (method.equals("create_line")) {
                gc.drawLine(
                        command.getCoordinate(0),
                        command.getCoordinate(1),
                        command.getCoordinate(2),
                        command.getCoordinate(3));
            }
            else if (method.equals("create_polygon")) {
                int[] coordinates = command.getAllCoordinates();
                if (newBackground != null) {
                    gc.fillPolygon(coordinates);
                }
            }
            else if (method.equals("create_text")) {
                Font oldFont = gc.getFont();
                gc.setFont(getFontOption(gc.getDevice(), command, "font"));
                int textFlags = 
                        SWT.DRAW_TRANSPARENT + 
                        SWT.DRAW_DELIMITER + 
                        SWT.DRAW_TAB;
                String text = command.getOption("text");
                Point size = gc.textExtent(text, textFlags);
                int x = command.getCoordinate(0);
                int y = command.getCoordinate(1);
                String anchor = command.getOption("anchor");
                anchor = anchor == null ? "center" : anchor;
                if (anchor.startsWith("s")) {
                    y -= size.y;
                }
                else if (anchor.startsWith("n")) {
                    // defaults to top
                }
                else {
                    y -= size.y/2;
                }
                if (anchor.endsWith("e")) {
                    x -= size.x;
                }
                else if (anchor.endsWith("w")) {
                    // defaults to left side
                }
                else {
                    x -= size.x/2;
                }
                gc.drawText(
                        text, 
                        x, 
                        y,
                        textFlags);
                gc.setFont(oldFont);
            }
            if (newForeground != null) {
                gc.setForeground(oldForeground);
            }
            if (newBackground != null) {
                gc.setBackground(oldBackground);
            }
            if (newLineWidthText != null) {
                gc.setLineWidth(oldLineWidth);
            }
        }
        disposeColors();
    }

    private Font getFontOption(Device device, CanvasCommand command, String name) {
    	FontOptions fontOptions = command.getFontOptions(name);
		int style = SWT.NORMAL;
		for (String styleName : fontOptions.getStyleNames()) {
			if (styleName.equals("bold")) {
				style += SWT.BOLD;
			}
			else if (styleName.equals("italic")) {
				style += SWT.ITALIC;
			}
		}
		return new Font(device, fontOptions.getName(), fontOptions.getSize(), style);

    }
    
    private void disposeColors() {
        for (Color color : colorMap.values()) {
            color.dispose();
        }
        colorMap.clear();
    }

    private Color getColor(String fill) {
        Color newForeground;
        newForeground = colorMap.get(fill);
        if (newForeground == null) {
            int red, green, blue;
            if ( ! fill.startsWith("#")) {
                red = green = blue = 0;
            }
            else {
                int colorInt = Integer.parseInt(fill.substring(1), 16);
                red = (colorInt >> 16) % 256;
                green = (colorInt >> 8) % 256;
                blue = colorInt % 256;
            }
            newForeground = new Color(Display.getCurrent(), red, green, blue);
            colorMap.put(fill, newForeground);
        }
        return newForeground;
    }

    public ILaunchConfiguration getLaunchConfig() {
        return launchConfig;
    }

    public void setLaunchConfig(ILaunchConfiguration launchConfig) {
        this.launchConfig = launchConfig;
    }
}

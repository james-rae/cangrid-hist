import fs from 'fs';

type CellNugget = {
    id: string;
    val: string;
};

type YearFile = {
    year: number;
    file: string;
};

type YearNugget = {
    year: number;
    goodstuff: Array<CellNugget>;
};

type HistNugget = {
    year: number;
    temp: string;
};

/**
 * Magic value to indicate there is no value
 */
const NO_VAL = '170141000918782798866653488190622531584.00';

/**
 * Max number of cols of cells
 */
const MAX_CELL_COL = 125;

/**
 * Max number of rows of cells
 */
const MAX_CELL_ROW = 95;

/**
 * Reads one grid file. Spits out array of valid values and grid cell keys
 * @param path path to source GRD file
 */
async function gridParser(path: string): Promise<Array<CellNugget>> {
    /**
     * Sauce file
     */
    const inDataStr = await fs.promises.readFile(path, 'utf8');

    /**
     * Sauce file split into file lines (array of strings)
     */
    const inDataLines = inDataStr.split(/\r?\n/);

    /**
     * Array of cell data we have generated
     */
    const nuggetBuffer: Array<CellNugget> = new Array(MAX_CELL_ROW * MAX_CELL_COL);

    /**
     * Tracks where we're inserting in the buffer
     */
    let bufferIdx = 0;

    /**
     * Grid col we are parsing
     */
    let gridCol = 0;

    /**
     * Grid row we are parsing
     */
    let gridRow = 0;

    inDataLines.forEach((inLine, lineNum) => {
        if (lineNum < 5) {
            // file header line
            if (lineNum === 1 && inLine !== '125 95') {
                // things prob gonna error spectacularly, give a little context.
                console.log('Careful now! File header indicates grid is in an unexpected layout.');
                console.log(path);
            }
        } else {
            // data line
            const trimData = inLine.trim();

            if (trimData && trimData !== NO_VAL) {
                // store the data nugget

                nuggetBuffer[bufferIdx] = {
                    id: `R${gridRow}C${gridCol}`,
                    val: trimData,
                };
                bufferIdx++;
            }

            gridCol++;
            if (gridCol >= MAX_CELL_COL) {
                gridCol = 0;
                gridRow++;
            }
        }
    });

    console.log('Done Thanks: ' + path);

    return nuggetBuffer.filter(Boolean);
}

async function sortAndWrite(validData: Array<YearNugget>) {
    function nuggetSort(a: HistNugget, b: HistNugget): number {
        if (a.year < b.year) {
            return -1;
        } else if (a.year > b.year) {
            return 1;
        }
        // a must be equal to b
        return 0;
    }

    const sorter = new Map<string, Array<HistNugget>>();

    // big gross inefficient resorter: go from values by year to values by cell
    validData.forEach((yearData) => {
        yearData.goodstuff.forEach((cellData) => {
            if (!sorter.has(cellData.id)) {
                // first time hitting this key, add an entry an initialize
                sorter.set(cellData.id, []);
            }

            const histForCell = sorter.get(cellData.id)!;
            histForCell.push({
                year: yearData.year,
                temp: cellData.val,
            });
        });
    });

    // sort each cell by year
    sorter.forEach((cellHistory) => {
        cellHistory.sort(nuggetSort);
    });

    const textMess: Array<string> = ['Year,Value,Cell_Id'];
    sorter.forEach((cellHistory, cellid) => {
        const textForCell = cellHistory
            .map((histNugget) => `${histNugget.year},${histNugget.temp},${cellid}`)
            .join('\r\n');
        textMess.push(textForCell);
    });

    const finalAsString = textMess.join('\r\n');

    // write out stuff to file
    // <!> Change this to adjust the name and location of the output file
    const finalFile = './guts/history.csv';

    await fs.promises.writeFile(finalFile, finalAsString, 'utf8');
}

async function parseAll(yearItems: Array<YearFile>): Promise<Array<YearNugget>> {
    if (yearItems.length > 0) {
        const fileInfo = yearItems.pop()!;
        const validCells = await gridParser(fileInfo.file);
        const thisNugget: YearNugget = { year: fileInfo.year, goodstuff: validCells };
        const futureCells = await parseAll(yearItems);

        futureCells.push(thisNugget);
        return futureCells;
    } else {
        return [];
    }
}

async function doAllTheWork() {
    // <!> Change this if you want to adjust the number of years, path location, or filename format
    const years = new Array(13).fill(2011).map((start, i) => start + i);
    const yearNuggets = years.map((year) => {
        return {
            file: `./guts/t${year}13.grd`,
            year,
        } as YearFile;
    });

    const allTheGoodness = await parseAll(yearNuggets);
    await sortAndWrite(allTheGoodness);
    console.log('fully done, completely thanks');
}

doAllTheWork();

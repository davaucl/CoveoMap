# CoveoMap 
This is a branch of the [Coveo Search-ui-seed](https://github.com/coveo/search-ui-seed) a fast starter / seed project to extend the Coveo Javascript Framework

Read our [Blog](https://github.com/coveo/search-ui-seed) to better understand the full scope of the project.

## Requirements
Node JS => 8.0

Google Map API key

Coveo Cloud Organization (with data containing lat/long fields)

## Setup

1. Fork / clone the repository.
2. `npm install` at the top of the repository.
3. `npm run watch` at the top of the repository.
4. Open your browser and and paste in the url  

## Get Our Data
If you wish to easily get data to try our map yourself you can just clone our [Python Pusher] and execute it to index data into your Push source of your Coveo Cloud organization 

## Structure

The code is written in [typescript](http://www.typescriptlang.org/) and compiled using [webpack](https://webpack.github.io/)

## Build task

* `npm run setup ` will copy the needed ressources (`index.html`, `templates`, etc.) in the `bin` folder.
* `npm run css` will build the sass files into a css file in the `bin` folder.
* `npm run build` will run the `setup`, `css` task, then compile the typescript code.

## Dev

`npm run watch` will start a [webpack dev server](https://webpack.js.org/concepts/). After it finishes, load [http://localhost:3000](http://localhost:3000) in a browser, and the `index.html` page should load.

Then, anytime you hit save in a typescript file, the server will reload your application.

## Useful Visual Studio Code Extensions

If you are using Visual Studio Code, you can install the following extensions:

### [TSLint](https://marketplace.visualstudio.com/items?itemName=eg2.tslint)

Shows inline linter problems in the code based on the `tslint.json` file. This will ensure that you are consistent with the formatting standards. 



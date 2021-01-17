const fetch = require('node-fetch');
const URL = require('url');
require('dotenv').config()
const config = require('./config');

const domain = config['domain']
const workspaceOid = config['workspaceOid'];
const projectOid = config['projectOid'];
const apiPath = config['apiPath']
const { APIKEY, USERNAME, PASSWORD } = process.env;

const baseUrl = `${domain}/${apiPath}`
const securityEndpoint = `${domain}/${apiPath}/security/authorize`

/* const headers = {
    "Content-Type":"application/json",
    'zsessionid': APIKEY
} */


var cached; 

const callSecurity = async() => {
    try{
        const response = await fetch(`${securityEndpoint}`, {
            method: 'GET', 
            mode: 'cors', 
            cache: 'no-cache', 
            credentials: 'same-origin', 
            headers: {
                'Content-Type':'application/json',
                'Authorization': 'Basic ' + Buffer.from(USERNAME + ":" + PASSWORD).toString('base64')
            },
            cookie: ''
          }); 
        return response; 
    }catch(err){
      console.log(err)
    }
}

  const parseCookies = (headers) =>  {
    const raw = headers.raw()['set-cookie'];
    const cookies = [];
    raw.forEach((entry) => {
      const parts = entry.split(';');
      const cookiePart = parts[0];
      if (cookiePart.includes('ZSESSIONID=') || cookiePart.includes('JSESSIONID=')){
        cookies.push(cookiePart);
      } 
    })
    return cookies.join(';');
  }


const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


const requestBody = async (workitemType, parent = undefined) => {
    let body = {};
    let timestamp = Date.now();
    if (workitemType.toLowerCase() == 'story' || workitemType.toLowerCase() == 'hierarchicalrequirement'){
        body = {"hierarchicalrequirement":{
        "workspace":`workspace/${workspaceOid}`,
        "project":`project/${projectOid}`, 
        "name": `Story ${timestamp}`,
        "description": "Story via REST",
        "portfolioitem": parent}}
    } else if(workitemType.toLowerCase() == 'feature'){
        body = {"portfolioitem/feature":{
            "workspace":`workspace/${workspaceOid}`,
            "project":`project/${projectOid}`, 
            "name": `Feature ${timestamp}`,
            "description": "Feature via REST"}}
    }
    return body;
 }

 const createItem = async (body = {}) => {
    console.log('create item...')
    console.log(`token inside createItem: ${cached['token']}`)
    const createEndpoint = `${Object.keys(body)[0]}/create?key=${cached['token']}`
    console.log(`${baseUrl}/${createEndpoint}`)
    try{
        const response = await fetch(`${baseUrl}/${createEndpoint}`, {
            method: 'POST', 
            mode: 'cors', 
            cache: 'no-cache', 
            credentials: 'same-origin', 
            headers: {
                "Content-Type":"application/json",
                cookie: cached['cookie']
            },
            body: JSON.stringify(body) 
          });
        return response.json(); 
    }catch(err){
      console.log(err)
    }
  }

  const updateItem = async (ref, type, newName) => {
    console.log(`update item: ${ref} ...`)
    const updateEndpoint = `${ref}?key=${cached['token']}`
    try{
        let body = {[type]:{name: newName}}
        console.log(JSON.stringify(body))
        const response = await fetch(updateEndpoint, {
            method: 'PUT', 
            mode: 'cors', 
            cache: 'no-cache', 
            credentials: 'same-origin', 
            headers: {
                "Content-Type":"application/json",
                cookie: cached['cookie']
            },
            body: JSON.stringify(body)
          });
        return response.json(); 
    } catch(err){
        console.log(err);
    }
  }

  const createAndUpdateItem = async (name, interval, loopCount) => {
    let response = await callSecurity()
    const data = await (
        response.headers.get('content-type').includes('json')
        ? response.json()
        : response.text()
    );
    cached = { 
        cookie: parseCookies(response.headers),
        token: data['OperationResult']['SecurityToken']
    };
    console.log(cached)
    let createResponse = await requestBody('Story').then(createItem)
    if (createResponse['CreateResult']['Errors'].length > 0){
        console.log(createResponse['CreateResult']['Errors'])
    }else{
        let ref = createResponse['CreateResult']['Object']['_ref'];
        let type = createResponse['CreateResult']['Object']['_type']
        console.log(`ref: ${ref}, type: ${type}`)
         let updateResponse = await updateItem(ref, type, name);
         if (updateResponse['OperationResult']['Errors'].length > 0){
            console.log(updateResponse['OperationResult']['Errors'])
         }
        await sleep(interval);
        for(let i = 0; i < loopCount; i++){
          await updateItem(ref, type, name + i);
        }
    }
}

  const argv = require('yargs')
    .command('post', 'create and update item', (yargs) => {
        yargs
        .positional('name', {describe: 'new name of item', default: 'foo'})
        .positional('interval', {describe: 'interval in ms between update requests', default: 10000})
        .positional('loop', {describe: 'loop count', default: 0})
    }, (argv) => {
        createAndUpdateItem(argv.name, argv.interval, argv.loop)
    }).argv;
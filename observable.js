 var observable = (function(){ 
    function isArray(o){
        return typeof o.push==="function"  && typeof o.length==="number"
    }
    
    function fieldname(propname){
        return '__' + propname;
    }
    
    function accessor(propname){
        return function(){
            if(arguments.length===0)
                return this[fieldname(propname)];
            
            if(arguments.length===1){
                var oldval = this[fieldname(propname)];
                var newval = arguments[0];
                this[fieldname(propname)] = newval;
                if(this.propertyChanged){
                    this.propertyChanged(propname, newval, oldval);
                }
            }
        }
    }
    
    
    function arrayAccessor(propname){
        return function(){
            if(arguments.length===0)
                    return this[fieldname(propname)];
            if(arguments.length===2){
                var arr = this[fieldname(propname)];
                var oldval =arr[arguments[0]];
                var newval = arguments[1];
                if(this.propertyChanged){
                    this.propertyChanged(propname, newval, oldval);
                }
            }
        }
    }
    
    return function(obj){
        var newObj = {};
        for(var prop in obj){
            if(obj.hasOwnProperty(prop)){
                var val = obj[prop];
                if(typeof val==="string" || typeof val==="number"){
                    newObj['__'  + prop] = val;
                    newObj[prop] = accessor(prop)       
                }else if(isArray(val)){
                    newObj['__'  + prop] = val;
                    newObj[prop] = arrayAccessor(prop)
                }
            }            
        }
        return newObj;
    }
})()


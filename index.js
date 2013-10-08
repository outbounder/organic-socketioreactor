var Organel = require("organic").Organel;
var url = require("url")
var path = require("path")
var glob = require("glob")
var _ = require("underscore")
var join = require("organic-alchemy").ws.join
var chain = require("organic-alchemy").ws.chain

module.exports = Organel.extend(function(plasma, dna){
  Organel.call(this, plasma, dna)
  this.reactions_cache = [];
  
  if(!this.config.reactions.extname)
    throw new Error(".reactions.extname not found")
  if(!this.config.reactions.root)
    throw new Error(".reactions.root not found")

  this.loadReactions()
  this.on(this.config.capture.type, this.attachReactions)

  this.url_cache = {}
},{
  attachReactions: function(c, next){
    var self = this;
    var connection = c.data
    this.reactions_cache.forEach(function(r){
      var reaction = join(self.findReactions(self.config.startReactions), 
        [r], self.findReactions(self.config.endReactions))
      connection.on(r.url, function(data, callback){
        var incomingChemical = {
          socket: connection,
          name: r.url,
          data: data
        }
        reaction(incomingChemical, function(c){
          if(c.err)
            chain(self.findReactions(self.config.exceptionReactions))(c, callback)
          else
            callback && callback(c)
        })
      })
    })
  },
  findReactions: function(c){
    if(!c) return []

    var self = this;

    if(c.length) { // array of reaction modules
      return _.map(_.clone(c), function(definition){
        if(definition.source){
          var fn = require(path.join(process.cwd(),definition.source))
          if(fn.init)
            return fn.init(self.plasma, definition, "/")
          if(definition.arguments)
            return fn.apply(fn, definition.arguments)
          if(fn.length == 2)
            return fn(self.plasma, self.config)
          else
            return fn(self.config)
        } else{
          var fn = require(path.join(process.cwd(),definition))
          if(fn.length == 1)
            return fn(self.config)
          else
            return fn
        }
      })
    }

    if(c.type == this.config.capture.type && c.name) { // request chemical
      var matchingReactions = []
      var url_path = c.name
      for(var i = 0; i<this.reactions_cache.length; i++){
        if(url_path.indexOf(this.reactions_cache[i].url) === 0){
          matchingReactions.push(this.reactions_cache[i])
        }
      }
      return matchingReactions
    }

    return [] // default is empty
  },
  loadReactions: function(){
    var self = this;
    glob(this.config.reactions.root+"/**/*"+this.config.reactions.extname, function(err, files){
      if(err) {console.error(err); throw err}
      files.forEach(function(reactionFile){
        try {
          var reaction = require(path.join(process.cwd(),reactionFile))
          var reactionUrl = reactionFile
              .replace(self.config.reactions.root, "")
              .replace(self.config.reactions.extname, "")
              .replace(self.config.reactions.indexname, "")
          if(reaction.init)
            reaction = reaction.init(self.plasma, self.config, reactionUrl)
          if(!reaction.url)
            reaction.url = reactionUrl
          self.reactions_cache.push(reaction)
        } catch(err){
          console.error(err.stack)
        }
      })
    })
  }
})
/**
 * jquery.pfold.js v1.0.0
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 * 
 * Copyright 2012, Codrops
 * http://www.codrops.com
 */

;( function( $, window, undefined ) {
	
	'use strict';

	/*
	* debouncedresize: special jQuery event that happens once after a window resize
	*
	* latest version and complete README available on Github:
	* https://github.com/louisremi/jquery-smartresize/blob/master/jquery.debouncedresize.js
	*
	* Copyright 2011 @louis_remi
	* Licensed under the MIT license.
	*/
	var $event = $.event,
	$special,
	resizeTimeout;

	$special = $event.special.debouncedresize = {
		setup: function() {
			$( this ).on( "resize", $special.handler );
		},
		teardown: function() {
			$( this ).off( "resize", $special.handler );
		},
		handler: function( event, execAsap ) {
			// Save the context
			var context = this,
				args = arguments,
				dispatch = function() {
					// set correct event type
					event.type = "debouncedresize";
					$event.dispatch.apply( context, args );
				};

			if ( resizeTimeout ) {
				clearTimeout( resizeTimeout );
			}

			execAsap ?
				dispatch() :
				resizeTimeout = setTimeout( dispatch, $special.threshold );
		},
		threshold: 50
	};

	// global
	var $window = $( window ),
		Modernizr = window.Modernizr;

	$.PFold = function( options, element ) {
		
		this.$el = $( element );
		this._init( options );
		
	};

	// the options
	$.PFold.defaults = {
		// perspective value
		perspective : 1200,
		// each folding step's speed
		speed : 450,
		// each folding step's easing 
		easing : 'linear',
		// delay between each (un)folding step (ms)
		folddelay : 0,
		// number of times the element will fold
		folds : 2,
		// the direction of each unfolding step
		folddirection : ['right','top'],
		// use overlays to simulate a shadow for each folding step 
		overlays : true,
		// the main container moves (translation) in order to keep its initial position 
		centered : false,
		// allows us to specify a different speed for the container's translation
		// values range : [0 - 1] 
		// if 0 the container jumps immediately to the final position (translation).
		// this is only valid if centered is true
		containerSpeedFactor : 1,
		// easing for the container transition
		// this is only valid if centered is true
		containerEasing : 'linear',
		// callbacks
		onEndFolding : function() { return false; },
		onEndUnfolding : function() { return false; }
	};

	$.PFold.prototype = {

		_init : function( options ) {
			
			// options
			this.options = $.extend( true, {}, $.PFold.defaults, options );

			// https://github.com/twitter/bootstrap/issues/2870
			this.transEndEventNames = {
				'WebkitTransition' : 'webkitTransitionEnd',
				'MozTransition' : 'transitionend',
				'OTransition' : 'oTransitionEnd',
				'msTransition' : 'MSTransitionEnd',
				'transition' : 'transitionend'
			};
			this.transEndEventName = this.transEndEventNames[ Modernizr.prefixed( 'transition' ) ];

			// suport for css 3d transforms and css transitions
			this.support = Modernizr.csstransitions && Modernizr.csstransforms3d;

			// apply perspective to the main container
			if( this.support ) {

				this.$el.css( 'perspective', this.options.perspective + 'px' );
				
				// set the transition to the main container
				// we will need to move it if:
				// this.options.centered is true;
				// the opened element goes outside of the viewport
				this.$el.css( 'transition', 'all ' + ( this.options.speed * this.options.folds * this.options.containerSpeedFactor ) + 'ms ' + this.options.containerEasing );

			}

			// initial sizes
			this.initialDim = {
				width : this.$el.width(),
				height : this.$el.height(),
				left : 0,
				top : 0
			};

			// change the layout
			this._layout();

			// cache some initial values:
			// initial content
			this.$iContent = this.$el.find( '.uc-initial' );
			this.iContent = this.$iContent.html();
			// final content
			this.$fContent = this.$el.find( '.uc-final' );
			this.fContent = this.$fContent.html();
			// this element is inserted in the main container and it will contain the initial and final content elements
			this.$finalEl = $( '<div class="uc-final-wrapper"></div>' ).append( this.$iContent.clone().hide(), this.$fContent ).hide();
			this.$el.append( this.$finalEl );
			
			// initial element's offset
			this._setDimOffset();

			// status
			this.opened = false;
			this.animating = false;
			
			// initialize events
			this._initEvents();

		},
		// changes the initial html structure
		// adds wrappers to the uc-initial-content and uc-final-content divs
		_layout : function() {

			var $initialContentEl = this.$el.children( 'div.uc-initial-content' ),
				finalDim = this._getFinalDim(),
				$finalContentEl = this.$el.children( 'div.uc-final-content' ).css( {
					width : finalDim.width,
					height : finalDim.height
				} );

			$initialContentEl.wrap( '<div class="uc-initial"></div>' );
			$finalContentEl.show().wrap( $( '<div class="uc-final"></div>' ) );

		},
		// initialize the necessary events
		_initEvents : function() {

			var self = this;

			$window.on( 'debouncedresize.pfold', function( event ) {

				// update offsets
				self._setDimOffset();
				
			} );

		},
		// set/update offsets
		_setDimOffset : function() {

			this.initialDim.offsetL = this.$el.offset().left - $window.scrollLeft();
			this.initialDim.offsetT = this.$el.offset().top - $window.scrollTop();
			this.initialDim.offsetR = $window.width() - this.initialDim.offsetL - this.initialDim.width;
			this.initialDim.offsetB = $window.height() - this.initialDim.offsetT - this.initialDim.height;

		},
		// gets the values needed to translate the main container (if options.centered is true)
		_getTranslationValue : function() {

			var x = 0, 
				y = 0,
				horizTimes = 0,
				vertTimes = 0;

			for( var i = 0; i < this.options.folds; ++i ) {

				// bottom as default
				var dir = this.options.folddirection[ i ] || 'bottom';

				switch( dir ) {

					case 'left' :

						x += this.initialDim.width * Math.pow( 2, horizTimes ) / 2;
						horizTimes += 1;
						break;

					case 'right' :

						x -= this.initialDim.width * Math.pow( 2, horizTimes ) / 2;
						horizTimes += 1;
						break;

					case 'top' :

						y += this.initialDim.height * Math.pow( 2, vertTimes ) / 2;
						vertTimes += 1;
						break;

					case 'bottom' :

						y -= this.initialDim.height * Math.pow( 2, vertTimes ) / 2;
						vertTimes += 1;
						break;
				
				}

			}

			return {
				x : x,
				y : y
			};

		},
		// gets the accumulated values for left, right, top and bottom once the element is opened
		_getAccumulatedValue : function() {

			var l = 0, 
				r = 0,
				t = 0, 
				b = 0,
				horizTimes = 0,
				vertTimes = 0;

			for( var i = 0; i < this.options.folds; ++i ) {

				// bottom as default
				var dir = this.options.folddirection[ i ] || 'bottom';

				switch( dir ) {

					case 'left' :

						l += this.initialDim.width * Math.pow( 2, horizTimes );
						horizTimes += 1;
						break;

					case 'right' :

						r += this.initialDim.width * Math.pow( 2, horizTimes );
						horizTimes += 1;
						break;

					case 'top' :

						t += this.initialDim.height * Math.pow( 2, vertTimes );
						vertTimes += 1;
						break;

					case 'bottom' :

						b += this.initialDim.height * Math.pow( 2, vertTimes );
						vertTimes += 1;
						break;
				
				}

			}

			return {
				l : l,
				r : r,
				t : t,
				b : b
			};

		},
		// gets the width and height of the element when it is opened
		_getFinalDim : function() {

			var l = 0, 
				r = 0,
				t = 0, 
				b = 0,
				horizTimes = 0,
				vertTimes = 0;

			for( var i = 0; i < this.options.folds; ++i ) {

				// bottom as default
				var dir = this.options.folddirection[ i ] || 'bottom';

				switch( dir ) {

					case 'left' : case 'right' :

						horizTimes += 1;
						break;

					case 'top' : case 'bottom' :

						vertTimes += 1;
						break;
				
				}

			}

			return {
				width : this.initialDim.width * Math.pow( 2, horizTimes ),
				height : this.initialDim.height * Math.pow( 2, vertTimes )
			};

		},
		// returns the sizes and positions for the element after each (un)folding step
		_updateStepStyle : function( action ) {

			var w, h, l, t;

			if( action === 'fold' ) {

				w = this.lastDirection === 'left' || this.lastDirection === 'right' ? this.lastStyle.width / 2 : this.lastStyle.width,
				h = this.lastDirection === 'left' || this.lastDirection === 'right' ? this.lastStyle.height : this.lastStyle.height / 2,
				l = this.lastDirection === 'left' ? this.lastStyle.left + this.lastStyle.width / 2 : this.lastStyle.left,
				t = this.lastDirection === 'top' ? this.lastStyle.top + this.lastStyle.height / 2  : this.lastStyle.top;

			}
			else {

				w = this.lastDirection === 'left' || this.lastDirection === 'right' ? this.lastStyle.width * 2 : this.lastStyle.width,
				h = this.lastDirection === 'left' || this.lastDirection === 'right' ? this.lastStyle.height : this.lastStyle.height * 2,
				l = this.lastDirection === 'left' ? this.lastStyle.left - this.lastStyle.width : this.lastStyle.left,
				t = this.lastDirection === 'top' ? this.lastStyle.top - this.lastStyle.height : this.lastStyle.top;	

			}

			return {
				width : w,
				height : h,
				left : l,
				top : t
			};

		},
		// get the opposite direction
		_getOppositeDirection : function( realdirection ) {

			var rvd;

			switch( realdirection ) {

				case 'left' : rvd = 'right'; break;
				case 'right' : rvd = 'left'; break;
				case 'top' : rvd = 'bottom'; break;
				case 'bottom' : rvd = 'top'; break;

			}

			return rvd;

		},
		// main function: unfolds and folds the element [options.folds] times by using recursive calls
		_start : function( action, step ) {

			// Basically we are replacing the element's content with 2 divisions, the top and bottom elements.
			// The top element will have a front and back faces. The front has the initial content for the first step
			// and the back will have the final content for the last step. For all the other cases the top element will be blank.
			// The bottom element will have the final content for the last step and will be blank for all the other cases.
			// We need to keep the right sizes and positions for these 2 elements, so we need to cache the previous step's state.

			step |= 0;
			
			var self = this,
				styleCSS = ( action === 'fold' ) ? {
					width : this.lastStyle.width,
					height : this.lastStyle.height,
					left : this.lastStyle.left,
					top : this.lastStyle.top
				} : this.initialDim,
				contentTopFront = '', contentBottom = '', contentTopBack = '',
				// direction for step [step]
				// bottom is the default value if none is present
				direction = ( action === 'fold' ) ?
					this.options.folddirection[ this.options.folds - 1 - step ] || 'bottom' :
					this.options.folddirection[ step ] || 'bottom',
				// future direction value (only for the "fold" action)
				nextdirection = ( action === 'fold' ) ? this.options.folddirection[ this.options.folds - 2 - step ] || 'bottom' : '';

			// remove uc-part divs inside the container (the top and bottom elements)
			this.$el.find( 'div.uc-part' ).remove();

			switch( step ) {

				// first step & last transition step
				case 0 : case this.options.folds - 1 :

					if( action === 'fold' ) {

						if( step === this.options.folds - 1 ) {

							styleCSS = this.initialDim;
							contentTopFront = this.iContent;

						}

						if( step === 0 ) {

							this._setDimOffset();

							// reset the translation of the main container
							this.$el.css( { left : 0, top : 0 } );

							var content = this._setLastStep( direction, styleCSS ),
								contentBottom = content.bottom,
								contentTopBack = content.top;

							this.$finalEl.hide().children().hide();

						}

					}
					else { // unfolding

						if( step === 0 ) {

							this._setDimOffset();

							// if options.centered is true, we need to center the container.
							// either ways we need to make sure the container does not move outside the viewport.
							// let's get the correct translation values for the container's transition
							var coords = this._getTranslationViewport();

							this.$el.addClass( 'uc-current' ).css( { left : coords.ftx, top : coords.fty } );

							contentTopFront = this.iContent;

							this.$finalEl.hide().children().hide();

						}
						else {

							styleCSS = this._updateStepStyle( action );

						}

						if( step === this.options.folds - 1 ) {

							var content = this._setLastStep( direction, styleCSS ),
								contentBottom = content.bottom,
								contentTopBack = content.top;

						}

					}

					break;

				// last step is to replace the topElement and bottomElement with a division that has the final content
				case this.options.folds :

					styleCSS = ( action === 'fold') ? this.initialDim : this._updateStepStyle( action );

					// remove top and bottom elements
					var contentIdx = ( action === 'fold' ) ? 0 : 1;
					this.$el
						.find( '.uc-part' )
						.remove();

					this.$finalEl.css( styleCSS ).show().children().eq( contentIdx ).show();
					
					this.opened = ( action === 'fold' ) ? false : true;
					this.animating = false;
					// nothing else to do
					if( action === 'fold' ) {

						this.$el.removeClass( 'uc-current' );
						this.options.onEndFolding();

					}
					else {

						this.options.onEndUnfolding();

					}
					return false;

					break;

				// all the other steps
				default :

					// style of new layout will depend on the last step direction
					styleCSS = this._updateStepStyle( action );

					break;

			}

			// transition properties for the step
			if( this.support ) {
				
				styleCSS.transition = 'all ' + this.options.speed + 'ms ' + this.options.easing;
			
			}

			var unfoldClass = 'uc-unfold-' + direction,
				topElClasses = ( action === 'fold' ) ? 'uc-unfold uc-part ' + unfoldClass : 'uc-part ' + unfoldClass,
				$topEl = $( '<div class="' + topElClasses + '"><div class="uc-front">' + contentTopFront + '</div><div class="uc-back">' + contentTopBack + '</div></div>' ).css( styleCSS ),
				$bottomEl = $( '<div class="uc-part uc-single">' + contentBottom + '</div>' ).css( styleCSS );

			// cache last direction and style
			this.lastDirection = ( action === 'fold' ) ? nextdirection : direction;
			this.lastStyle = styleCSS;

			// append new elements
			this.$el.append( $bottomEl, $topEl );

			// add overlays
			if( this.options.overlays && this.support ) {

				this._addOverlays( action, $bottomEl, $topEl );

			}

			setTimeout( function() {

				// apply style
				( action === 'fold' ) ? $topEl.removeClass( 'uc-unfold' ) : $topEl.addClass( 'uc-unfold' );

				if( self.support ) {

					$topEl.on( self.transEndEventName , function(event) {

						if( event.target.className !== 'uc-flipoverlay' && step < self.options.folds ) {

							// goto next step in [options.folddelay] ms
							setTimeout( function() { self._start( action, step + 1 ); }, self.options.folddelay );

						}

					} );

				}
				else {
					
					// goto next step
					self._start( action, step + 1 );

				}

				if( self.options.overlays && self.support ) {

					var bo = ( action === 'fold' ) ? 1 : 0,
						tbo = ( action === 'fold' ) ? .5 : 0,
						tfo = ( action === 'fold' ) ? 0 : .5;

					self.$bottomOverlay.css( 'opacity', bo );
					self.$topBackOverlay.css( 'opacity', tbo );
					self.$topFrontOverlay.css( 'opacity', tfo );

				}
			
			} , 30 );

		},
		// gets the translation values for the container's transition
		_getTranslationViewport : function() {

			// the accumulatedValues stores the left, right, top and bottom increments to the final/opened element relatively to the initial/closed element
			var accumulatedValues = this._getAccumulatedValue(),
				tx = 0,
				ty = 0;

			// the final offsets for the opened element
			this.fOffsetL = this.initialDim.offsetL - accumulatedValues.l;
			this.fOffsetT = this.initialDim.offsetT - accumulatedValues.t;
			this.fOffsetR = this.initialDim.offsetR - accumulatedValues.r;
			this.fOffsetB = this.initialDim.offsetB - accumulatedValues.b;

			if( this.fOffsetL < 0 ) {
				tx = Math.abs( this.fOffsetL );
			}
			if( this.fOffsetT < 0 ) {
				ty = Math.abs( this.fOffsetT );
			}
			if( this.fOffsetR < 0 ) {
				tx -= Math.abs( this.fOffsetR );
			}
			if( this.fOffsetB < 0 ) {
				ty -= Math.abs( this.fOffsetB );
			}

			// final translation values
			var ftx = tx,
				fty = ty;

			if( this.options.centered ) {

				var translationValue = this._getTranslationValue();

				if( translationValue.x > 0 && this.fOffsetR + translationValue.x >= 0 ) {

					ftx = ( this.fOffsetL >= 0 ) ? Math.min( translationValue.x , this.fOffsetR ) : translationValue.x + ( tx - translationValue.x );

				}
				else if( translationValue.x < 0 && this.fOffsetL + translationValue.x >= 0 ) {

					ftx = ( this.fOffsetR >= 0 ) ? Math.min( translationValue.x , this.fOffsetL ) : translationValue.x + ( tx - translationValue.x );

				}
				else {

					ftx = translationValue.x + ( tx - translationValue.x );

				}

				if( translationValue.y > 0 && this.fOffsetB + translationValue.y >= 0 ) {

					fty = ( this.fOffsetT >= 0 ) ? Math.min( translationValue.y , this.fOffsetB ) : translationValue.y + ( ty - translationValue.y );

				}
				else if( translationValue.y < 0 && this.fOffsetT + translationValue.y >= 0 ) {

					fty = ( this.fOffsetB >= 0 ) ? Math.min( translationValue.y , this.fOffsetT ) : translationValue.y + ( ty - translationValue.y );

				}
				else {

					fty = translationValue.y + ( ty - translationValue.y );

				}

			}

			return {
				ftx : ftx,
				fty : fty
			};

		},
		// sets the last step's content
		_setLastStep : function( direction, styleCSS ) {

			var contentBottom, contentTopBack,
				contentBottomStyle = '',
				contentTopBackStyle = '';

			switch( direction ) {

				case 'bottom' :
					contentTopBackStyle = 'margin-top: -' + styleCSS.height + 'px';
					break;
				case 'top' : 
					contentBottomStyle = 'margin-top: -' + styleCSS.height + 'px';
					break;
				case 'left' :
					contentTopBackStyle = 'width:' + ( styleCSS.width * 2 ) + 'px';
					contentBottomStyle = 'width:' + ( styleCSS.width * 2 ) + 'px;margin-left: -' + styleCSS.width + 'px';
					break;
				case 'right' :
					contentTopBackStyle = 'with:' + ( styleCSS.width * 2 ) + 'px;margin-left: -' + styleCSS.width + 'px';
					contentBottomStyle = 'width:' + ( styleCSS.width * 2 ) + 'px';
					break;

			}

			contentBottom = '<div class="uc-inner"><div class="uc-inner-content" style="' + contentBottomStyle + '">' + this.fContent + '</div></div>';

			var contentTopBackClasses = direction === 'top' || direction === 'bottom' ? 'uc-inner uc-inner-rotate' : 'uc-inner';
				contentTopBack = '<div class="' + contentTopBackClasses + '"><div class="uc-inner-content" style="' + contentTopBackStyle + '">' + this.fContent + '</div></div>';

			return {
				bottom : contentBottom,
				top : contentTopBack
			};

		},
		// adds overlays to the "(un)folding" elements if the options.overlays is true
		_addOverlays : function( action, $bottomEl, $topEl ) {

			var bottomOverlayStyle, topFrontOverlayStyle, topBackOverlayStyle;

			this.$bottomOverlay = $( '<div class="uc-overlay"></div>' );
			this.$topFrontOverlay = $( '<div class="uc-flipoverlay"></div>' );
			this.$topBackOverlay = $( '<div class="uc-flipoverlay"></div>' );

			if( action === 'fold' ) {

				bottomOverlayStyle = {
					transition : 'opacity ' + ( this.options.speed / 2 ) + 'ms ' + this.options.easing + ' ' + ( this.options.speed / 2 ) + 'ms'
				};

				topFrontOverlayStyle = {
					opacity : .5,
					transition : 'opacity ' + ( this.options.speed / 2 ) + 'ms ' + this.options.easing
				};

				topBackOverlayStyle = {
					opacity : 0,
					transition : 'opacity ' + ( this.options.speed / 2 ) + 'ms ' + this.options.easing
				};

			}
			else {

				bottomOverlayStyle = {
					opacity : 1,
					transition : 'opacity ' + ( this.options.speed / 2 ) + 'ms ' + this.options.easing
				};

				topFrontOverlayStyle = {
					transition : 'opacity ' + ( this.options.speed / 2 ) + 'ms ' + this.options.easing
				};

				topBackOverlayStyle = {
					opacity : .5,
					transition : 'opacity ' + ( this.options.speed / 2 ) + 'ms ' + this.options.easing + ' ' + ( this.options.speed / 2 ) + 'ms'
				};

			}

			$bottomEl.append( this.$bottomOverlay.css( bottomOverlayStyle ) );
			$topEl.children( 'div.uc-front' )
				  .append( this.$topFrontOverlay.css( topFrontOverlayStyle ) )
				  .end()
				  .children( 'div.uc-back' )
				  .append( this.$topBackOverlay.css( topBackOverlayStyle ) );

		},
		// public method: unfolds the element
		unfold : function() {

			// if opened already or currently (un)folding return
			if( this.opened || this.animating ) {

				return false;

			}

			this.animating = true;
			this._start( 'unfold' );

		},
		// public method: folds the element
		fold : function() {

			// if not opened or currently (un)folding return
			if( !this.opened || this.animating ) {

				return false;

			}

			this.animating = true;
			this._start( 'fold' );

		},
		// public method: returns 'opened' or 'closed'
		getStatus : function() {

			return ( this.opened ) ? 'opened' : 'closed';

		}

	};
	
	var logError = function( message ) {

		if ( window.console ) {

			window.console.error( message );
		
		}

	};
	
	$.fn.pfold = function( options ) {

		var instance = $.data( this, 'pfold' );
		
		if ( typeof options === 'string' ) {
			
			var args = Array.prototype.slice.call( arguments, 1 );
			
			this.each(function() {
			
				if ( !instance ) {

					logError( "cannot call methods on pfold prior to initialization; " +
					"attempted to call method '" + options + "'" );
					return;
				
				}
				
				if ( !$.isFunction( instance[options] ) || options.charAt(0) === "_" ) {

					logError( "no such method '" + options + "' for pfold instance" );
					return;
				
				}
				
				instance[ options ].apply( instance, args );
			
			});
		
		} 
		else {
		
			this.each(function() {
				
				if ( instance ) {

					instance._init();
				
				}
				else {

					instance = $.data( this, 'pfold', new $.PFold( options, this ) );
				
				}

			});
		
		}
		
		return instance;
		
	};
	
} )( jQuery, window );